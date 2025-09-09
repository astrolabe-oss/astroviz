/**
 * edgeUtils.js - Geometry and edge styling utilities for GraphRenderer
 * 
 * Contains mathematical utilities for 2D geometry operations and advanced edge styling
 * used in network graph visualization. Includes line-circle intersections, point containment,
 * and gradient generation for sophisticated edge styling.
 */

export class EdgeUtils {
  /**
   * Calculate edge segments with flexible group filtering
   * Consolidated function to replace multiple duplicate segment calculators
   * @param {Object} edge - Edge with source and target
   * @param {Map} positionMap - Map of node positions
   * @param {Array} groups - Array of group circles to check intersections
   * @param {Function} filterFn - Optional filter function to determine styling
   * @returns {Array} Array of segments with styling information
   */
  static calculateEdgeSegments(edge, positionMap, groups, filterFn = null) {
    const sourcePos = positionMap.get(edge.source);
    const targetPos = positionMap.get(edge.target);
    
    if (!sourcePos || !targetPos) return [];
    
    // Start with the full edge as one segment
    const points = [
      { t: 0, x: sourcePos.x, y: sourcePos.y },
      { t: 1, x: targetPos.x, y: targetPos.y }
    ];
    
    // Find all intersection points with groups
    for (const group of groups) {
      const intersections = this.getLineCircleIntersections(sourcePos, targetPos, group);
      
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
      const midX = sourcePos.x + midT * (targetPos.x - sourcePos.x);
      const midY = sourcePos.y + midT * (targetPos.y - sourcePos.y);
      
      // Use filter function if provided, otherwise default to false
      const insideUnrelatedGroup = filterFn ? filterFn({ x: midX, y: midY }, groups) : false;
      
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
   * Extract rendering data from D3 hierarchy for edge processing
   * @param {Object} packedRoot - D3 packed hierarchy root
   * @returns {Object} Object with position maps and group data
   */
  static extractRenderingData(packedRoot) {
    // Create position map for nodes
    const positionMap = new Map();
    packedRoot.descendants().forEach(d => {
      if (!d.data.isVirtual) {
        positionMap.set(d.data.id, { x: d.x + 25, y: d.y + 25 });
      }
    });
    
    // Create group circles map for intersection detection
    const applicationGroups = [];
    const clusterGroups = [];
    const nodeToAppMap = new Map();
    const nodeToClusterMap = new Map();
    
    // Build group data and node mappings
    packedRoot.descendants().forEach(d => {
      if (d.data.isGroup && !d.data.isVirtual) {
        const circle = {
          id: d.data.id,
          x: d.x + 25,
          y: d.y + 25,
          r: d.r,
          isApp: d.data.id.startsWith('app-'),
          isCluster: d.data.id.startsWith('cluster')
        };
        
        // Track application groups
        if (circle.isApp) {
          applicationGroups.push(circle);
          
          // Map all child nodes to this application
          if (d.children) {
            const mapChildNodes = (node) => {
              if (!node.data.isGroup) {
                nodeToAppMap.set(node.data.id, d.data.id);
              }
              if (node.children) {
                node.children.forEach(mapChildNodes);
              }
            };
            d.children.forEach(mapChildNodes);
          }
        }
        
        // Track cluster groups
        if (circle.isCluster) {
          clusterGroups.push(circle);
          
          // Map all child nodes to this cluster
          if (d.children) {
            const mapChildNodes = (node) => {
              if (!node.data.isGroup) {
                nodeToClusterMap.set(node.data.id, d.data.id);
              }
              if (node.children) {
                node.children.forEach(mapChildNodes);
              }
            };
            d.children.forEach(mapChildNodes);
          }
        }
      }
    });
    
    return {
      positionMap,
      applicationGroups,
      clusterGroups,
      nodeToAppMap,
      nodeToClusterMap
    };
  }

  /**
   * Shorten edge coordinates to accommodate arrow markers
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
   * Find home groups for an edge based on node mappings
   * @param {Object} edge - Edge with source and target
   * @param {Map} nodeToAppMap - Map of node to application group
   * @param {Map} nodeToClusterMap - Map of node to cluster group
   * @returns {Object} Object with homeApps and homeClusters Sets
   */
  static findHomeGroups(edge, nodeToAppMap, nodeToClusterMap) {
    const homeApps = new Set();
    const homeClusters = new Set();
    
    const sourceApp = nodeToAppMap.get(edge.source);
    const targetApp = nodeToAppMap.get(edge.target);
    if (sourceApp) homeApps.add(sourceApp);
    if (targetApp) homeApps.add(targetApp);
    
    const sourceCluster = nodeToClusterMap.get(edge.source);
    const targetCluster = nodeToClusterMap.get(edge.target);
    if (sourceCluster) homeClusters.add(sourceCluster);
    if (targetCluster) homeClusters.add(targetCluster);
    
    return { homeApps, homeClusters };
  }

  /**
   * Create filter function for unrelated groups
   * @param {Set} homeApps - Set of home application group IDs
   * @param {Set} homeClusters - Set of home cluster group IDs
   * @param {Array} applicationGroups - Array of application group circles
   * @param {Array} clusterGroups - Array of cluster group circles
   * @returns {Function} Filter function (point, allGroups) => boolean
   */
  static createUnrelatedGroupFilter(homeApps, homeClusters, applicationGroups, clusterGroups) {
    return (point, allGroups) => {
      // Check if inside any unrelated application
      for (const appGroup of applicationGroups) {
        if (this.pointInCircle(point, appGroup)) {
          if (!homeApps.has(appGroup.id)) return true;
        }
      }
      
      // Check if inside any unrelated cluster
      for (const clusterGroup of clusterGroups) {
        if (this.pointInCircle(point, clusterGroup)) {
          if (!homeClusters.has(clusterGroup.id)) return true;
        }
      }
      
      return false;
    };
  }
}