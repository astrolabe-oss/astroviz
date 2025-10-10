/**
 * edgeUtils.js - Geometry and edge styling utilities for GraphRenderer
 *
 * Contains mathematical utilities for 2D geometry operations and advanced edge styling
 * used in network graph visualization. Includes line-circle intersections, point containment,
 * and gradient generation for sophisticated edge styling.
 */

import * as d3 from 'd3';
import { FeatureRegistry } from './featureRegistry.js';
import { getOptions } from './options.js';

export class EdgeUtils {
  /**
   * Flag to track if async update should be cancelled
   */
  static asyncUpdateCancelled = false;

  /**
   * Get all nodes and edges connected to a given node
   * @param {Object} context - Graph context object
   * @param {string} nodeId - ID of the node to find connections for
   * @returns {Object} - Object with connected nodes Set and edges Array
   */
  static getConnectedNodes(context, nodeId) {
    const connectedNodes = new Set([nodeId]); // Include the node itself
    const connectedEdges = [];

    if (!context.state.edges) return { nodes: connectedNodes, edges: connectedEdges };

    context.state.edges.forEach((edge) => {
      if (edge.source === nodeId) {
        connectedNodes.add(edge.target);
        connectedEdges.push(`${edge.source}-${edge.target}`);
      } else if (edge.target === nodeId) {
        connectedNodes.add(edge.source);
        connectedEdges.push(`${edge.source}-${edge.target}`);
      }
    });

    return { nodes: connectedNodes, edges: connectedEdges };
  }

  /**
   * Initialize arrow markers for edges
   * @param {d3.Selection} defs - SVG defs section
   */
  static initArrowMarkers(defs) {
    const createArrowMarker = (id, color) => {
      const marker = defs.append('marker')
        .attr('id', id)
        .attr('viewBox', '0 0 10 10')
        .attr('refX', 7)  // Position reference inside the arrow so tip extends past line
        .attr('refY', 5)
        .attr('markerWidth', 5)  // Half the original size
        .attr('markerHeight', 5)  // Half the original size
        .attr('orient', 'auto-start-reverse');
      
      marker.append('path')
        .attr('d', 'M 0 0 L 10 5 L 0 10 z')
        .attr('fill', color)
        .attr('opacity', 1.0);
    };

    // Create all arrow markers for different edge states
    createArrowMarker('arrow', '#888');                    // Default gray arrow for normal edges
    createArrowMarker('arrow-connected', '#4444ff');       // Purple arrow for connected (highlighted) edges  
    createArrowMarker('arrow-path', '#FFA500');            // Gold arrow for path (trace) edges
  }

  /**
   * Create or update gradient for an edge
   */
  static createEdgeGradient(defs, edgeId, stops, x1, y1, x2, y2) {
    const gradientId = `edge-gradient-${edgeId}`;

    // Remove existing gradient
    defs.select(`#${gradientId}`).remove();

    // Create new gradient aligned with the line
    const gradient = defs.append('linearGradient')
      .attr('id', gradientId)
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', x1)
      .attr('y1', y1)
      .attr('x2', x2)
      .attr('y2', y2);

    // Add stops
    stops.forEach(stop => {
      gradient.append('stop')
        .attr('offset', stop.offset)
        .attr('stop-color', stop.color)
        .attr('stop-opacity', stop.opacity);
    });

    return `url(#${gradientId})`;
  }

  /**
   * Render edges using vertexMap data and edge list
   * @param {Object} context - Rendering context
   * @param {Object} options - Rendering options (nodeRadius, etc)
   */
  static renderEdges(context) {
    if (!context.state.edges) return;

    const vertexMap = context.state.vertexMap;

    // Collect all groups for gradient calculation
    const allGroups = [];
    vertexMap.forEach((vertex) => {
      if (vertex.isGroup && !vertex.isVirtual) {
        allGroups.push(vertex);
      }
    });

    // Clear existing edges
    context.dom.layers.edgeLayer.selectAll('line.edge').remove();

    // Create single gradient edges using segment data
    context.state.edges.forEach((edge, edgeIndex) => {
      // Get source and target vertices directly from vertexMap
      const source = vertexMap.get(edge.source);
      const target = vertexMap.get(edge.target);

      if (!source || !target) {
        return;
      }

      // Calculate adjusted endpoints - shorten from both source and target
      const sourceRadius = source.r || getOptions().nodeRadius;
      const targetRadius = target.r || getOptions().nodeRadius;
      const { x1: adjustedSourceX, y1: adjustedSourceY, x2: adjustedTargetX, y2: adjustedTargetY } =
        EdgeUtils.shortenEdgeForBothEnds(source, target, sourceRadius, targetRadius);

      // Find all ancestor groups containing this edge's endpoints (hierarchy-agnostic)
      const homeGroups = EdgeUtils.findContainingGroups(edge, vertexMap);

      // Create filter function - mark segments as "unrelated" if they pass through groups that don't contain endpoints
      const isUnrelatedGroupFilter = (point) => {
        // Check if point is inside any group that's NOT a home group
        for (const group of allGroups) {
          if (EdgeUtils.pointInCircle(point, group) && !homeGroups.has(group.id)) {
            return true; // Inside an unrelated group
          }
        }
        return false;
      };

      const segments = EdgeUtils.calculateEdgeSegments(
        { x: adjustedSourceX, y: adjustedSourceY },
        { x: adjustedTargetX, y: adjustedTargetY },
        allGroups,
        isUnrelatedGroupFilter
      );

      // Convert segments to gradient stops
      const gradientStops = EdgeUtils.segmentsToGradientStops(segments);

      // Create unique edge ID
      const edgeId = `${edge.source}-${edge.target}-${edgeIndex}`;

      // Create gradient for this edge (use adjusted coordinates)
      const strokeStyle = EdgeUtils.createEdgeGradient(
        context.dom.defs,
        edgeId,
        gradientStops,
        adjustedSourceX,
        adjustedSourceY,
        adjustedTargetX,
        adjustedTargetY
      );
      const strokeWidth = 1.5;

      // Create single line with appropriate styling including filtering state
      context.dom.layers.edgeLayer
        .append('line')
        .attr('class', 'edge')
        .attr('data-source', edge.source)
        .attr('data-target', edge.target)
        .attr('data-edge-id', `${edge.source}-${edge.target}-${edgeIndex}`)
        .attr('x1', adjustedSourceX)
        .attr('y1', adjustedSourceY)
        .attr('x2', adjustedTargetX)
        .attr('y2', adjustedTargetY)
        .attr('stroke', strokeStyle)
        .attr('stroke-width', strokeWidth)
        .attr('marker-end', 'url(#arrow)');
    });
  }

  /**
   * Update all edges asynchronously with cancellation support
   */
  static async updateAllEdgesAsync(context) {
    // Reset cancellation flag for this update
    EdgeUtils.asyncUpdateCancelled = false;

    // Yield to browser to keep UI responsive
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check if cancelled
    if (EdgeUtils.asyncUpdateCancelled) {
      return;
    }

    // Now do the actual update
    await EdgeUtils.renderEdgesWithHooks(context);
  }

  /**
   * Cancel any in-progress edge update
   */
  static cancelPendingUpdates() {
    EdgeUtils.asyncUpdateCancelled = true;
  }


  /**
   * Calculate edge segments with flexible group filtering
   * Consolidated function to replace multiple duplicate segment calculators
   * @param {Object} source - Source vertex with x, y properties
   * @param {Object} target - Target vertex with x, y properties
   * @param {Array} groups - Array of group vertices to check intersections
   * @param {Function} filterFn - Optional filter function to determine styling
   * @returns {Array} Array of segments with styling information
   */
  static calculateEdgeSegments(source, target, groups, filterFn = null) {
    if (!source || !target) return [];

    // Start with the full edge as one segment
    const points = [
      { t: 0, x: source.x, y: source.y },
      { t: 1, x: target.x, y: target.y }
    ];

    // Find all intersection points with groups
    for (const group of groups) {
      const intersections = this.getLineCircleIntersections(source, target, group);

      for (const intersection of intersections) {
        points.push({
          t: intersection.t,
          x: intersection.x,
          y: intersection.y
        });
      }
    }

    // Sort points by parameter t
    points.sort((a, b) => a.t - b.t);

    // Remove duplicates (very close points)
    const uniquePoints = [];
    for (const point of points) {
      if (uniquePoints.length === 0 || Math.abs(point.t - uniquePoints[uniquePoints.length - 1].t) > 0.001) {
        uniquePoints.push(point);
      }
    }

    // Create segments and determine styling
    const segments = [];
    for (let i = 0; i < uniquePoints.length - 1; i++) {
      const start = uniquePoints[i];
      const end = uniquePoints[i + 1];

      // Check midpoint to determine if segment should be styled as unrelated
      const midT = (start.t + end.t) / 2;
      const midX = source.x + midT * (target.x - source.x);
      const midY = source.y + midT * (target.y - source.y);

      // Use filter function if provided, otherwise default to false
      const insideUnrelatedGroup = filterFn ? filterFn({ x: midX, y: midY }) : false;

      segments.push({
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        insideUnrelatedGroup: insideUnrelatedGroup
      });
    }

    return segments;
  }

  /**
   * Convert segment data to SVG gradient stops
   * Creates percentage-based gradient stops for smooth color transitions
   * @param {Array} segments - Array of segments with styling information
   * @returns {Array} Array of gradient stops
   */
  static segmentsToGradientStops(segments) {
    if (segments.length === 0) return [];
    
    const stops = [];
    let currentOffset = 0;
    
    // Calculate total length for percentage calculation
    let totalLength = 0;
    segments.forEach(segment => {
      const dx = segment.x2 - segment.x1;
      const dy = segment.y2 - segment.y1;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    });
    
    segments.forEach((segment, index) => {
      const dx = segment.x2 - segment.x1;
      const dy = segment.y2 - segment.y1;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      const segmentPercent = (segmentLength / totalLength) * 100;
      
      // Add stop at start of segment
      const startPercent = currentOffset;
      const endPercent = currentOffset + segmentPercent;
      
      if (segment.insideUnrelatedGroup) {
        // Light styling for unrelated segments
        stops.push({
          offset: `${startPercent}%`,
          color: '#ccc',
          opacity: 0.2
        });
        stops.push({
          offset: `${endPercent}%`,
          color: '#ccc', 
          opacity: 0.2
        });
      } else {
        // Solid styling for related segments
        stops.push({
          offset: `${startPercent}%`,
          color: '#888',
          opacity: 0.4
        });
        stops.push({
          offset: `${endPercent}%`,
          color: '#888',
          opacity: 0.4
        });
      }
      
      currentOffset = endPercent;
    });
    
    return stops;
  }

  /**
   * Get all intersection points between a line segment and a circle
   * @param {Object} p1 - Start point {x, y}
   * @param {Object} p2 - End point {x, y}
   * @param {Object} circle - Circle {x, y, r}
   * @returns {Array} Array of intersection points with parameter t
   */
  static getLineCircleIntersections(p1, p2, circle) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const fx = p1.x - circle.x;
    const fy = p1.y - circle.y;
    
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = (fx * fx + fy * fy) - circle.r * circle.r;
    
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) return []; // No intersection
    
    const intersections = [];
    const sqrt_discriminant = Math.sqrt(discriminant);
    
    // Check both intersection points
    const t1 = (-b - sqrt_discriminant) / (2 * a);
    const t2 = (-b + sqrt_discriminant) / (2 * a);
    
    if (t1 >= 0 && t1 <= 1) {
      intersections.push({
        t: t1,
        x: p1.x + t1 * dx,
        y: p1.y + t1 * dy
      });
    }
    
    if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 0.001) {
      intersections.push({
        t: t2,
        x: p1.x + t2 * dx,
        y: p1.y + t2 * dy
      });
    }
    
    return intersections;
  }

  /**
   * Check if a point is inside a circle
   * @param {Object} point - Point {x, y}
   * @param {Object} circle - Circle {x, y, r}
   * @returns {boolean} True if point is inside circle
   */
  static pointInCircle(point, circle) {
    const dx = point.x - circle.x;
    const dy = point.y - circle.y;
    return (dx * dx + dy * dy) <= (circle.r * circle.r);
  }



  /**
   * Shorten edge coordinates from both ends to accommodate node radii
   * @param {Object} sourcePos - Source position {x, y}
   * @param {Object} targetPos - Target position {x, y}
   * @param {number} sourceRadius - Source node/group radius
   * @param {number} targetRadius - Target node/group radius
   * @returns {Object} Adjusted coordinates {x1, y1, x2, y2}
   */
  static shortenEdgeForBothEnds(sourcePos, targetPos, sourceRadius, targetRadius) {
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    // Calculate ratios for both ends
    const sourceRatio = sourceRadius / length;
    const targetRatio = targetRadius / length;

    return {
      x1: sourcePos.x + dx * sourceRatio,
      y1: sourcePos.y + dy * sourceRatio,
      x2: sourcePos.x + dx * (1 - targetRatio),
      y2: sourcePos.y + dy * (1 - targetRatio)
    };
  }

  /**
   * Shorten edge coordinates to accommodate arrow markers (legacy - kept for compatibility)
   * @param {Object} sourcePos - Source position {x, y}
   * @param {Object} targetPos - Target position {x, y}
   * @param {number} shortenBy - Amount to shorten by
   * @returns {Object} Adjusted coordinates {x1, y1, x2, y2}
   */
  static shortenEdgeForArrow(sourcePos, targetPos, shortenBy) {
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const ratio = (length - shortenBy) / length;

    return {
      x1: sourcePos.x,
      y1: sourcePos.y,
      x2: sourcePos.x + dx * ratio,
      y2: sourcePos.y + dy * ratio
    };
  }

  /**
   * Find all ancestor groups containing an edge's endpoints (hierarchy-agnostic)
   * @param {Object} edge - Edge with source and target
   * @param {Map} vertexMap - Map of all vertices
   * @returns {Set} Set of group IDs that contain either endpoint
   */
  static findContainingGroups(edge, vertexMap) {
    const homeGroups = new Set();

    // Walk up parent chain from source
    let current = vertexMap.get(edge.source);
    while (current?.parentId) {
      homeGroups.add(current.parentId);
      current = vertexMap.get(current.parentId);
    }

    // Walk up parent chain from target
    current = vertexMap.get(edge.target);
    while (current?.parentId) {
      homeGroups.add(current.parentId);
      current = vertexMap.get(current.parentId);
    }

    return homeGroups;
  }



  // ========================================================================
  // Unified Rendering Pipeline
  // ========================================================================

  /**
   * Apply all feature styles to existing DOM elements
   * Called after any render operation or when only styles change
   * @param {Object} context - Rendering context
   */
  static renderEdgesWithHooks(context) {
    // Re-render edges to ensure proper gradients
    EdgeUtils.renderEdges(context);

    // Apply all feature styles to edges
    context.dom.layers.edgeLayer.selectAll('.edge').each(function() {
      const edge = d3.select(this);
      const source = edge.attr('data-source');
      const target = edge.attr('data-target');

      // Let all registered features apply their styles
      FeatureRegistry.edgePostRenderHooks(edge, source, target, context);
    });
  }
}