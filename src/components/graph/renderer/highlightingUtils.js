/**
 * Copyright 2025 Lightwire, LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as d3 from 'd3';
import { NodeUtils } from './nodeUtils.js';
import { EdgeUtils } from './edgeUtils.js';
import { STYLES } from './styles.js';
import { FilteringUtils } from './filteringUtils.js';

/**
 * HighlightingUtils - Utility class for handling graph highlighting logic
 *
 * This class manages highlighting state and provides methods for highlighting nodes,
 * edges, and groups in the graph visualization.
 */
export class HighlightingUtils {
    /**
     * Internal highlighting state
     */
    static state = {
        // Current selection state
        headNode: null,              // Most recently selected node (head of selection)
        tracePath: {                 // Golden path being traced
            nodes: new Set(),
            edges: new Set()
        },

        // Visual state tracking
        activeHighlights: {          // Currently highlighted elements
            nodes: new Map(),         // nodeId -> {type: 'head'|'connected'|'path', originalColor}
            edges: new Map()          // edgeKey -> {type: 'connected'|'path', originalStroke, originalWidth}
        },

        // Application group selection
        selectedApplications: new Set()  // Set of selected application names
    };
  /**
   * Apply highlight-based styling to an edge (stroke, stroke-width, stroke-dasharray)
   * @param {d3.Selection} edge - D3 selection of the edge
   * @param {string} state - Highlight state ('normal'|'path'|'connected'|'connected-inbound')
   * @param {Object} styles - Styling configuration object
   */
  static applyHighlightStyleToEdge(edge, state, styles) {
    const highlights = styles.highlights;

    switch (state) {
      case 'normal':
        // Get stored original values or use defaults
        const originalStroke = edge.attr('data-original-stroke') || '#999';
        const originalWidth = edge.attr('data-original-stroke-width') || '1';

        edge
          .attr('stroke', originalStroke)
          .attr('stroke-width', originalWidth)
          .attr('marker-end', 'url(#arrow)')  // Default gray arrow
          .style('filter', null)
          .style('stroke-dasharray', null);  // No dashes for normal state
        break;

      case 'path':
        const pathStyle = highlights.path.edge;
        edge
          .attr('stroke', pathStyle.stroke)
          .attr('stroke-width', pathStyle.strokeWidth)
          .attr('marker-end', 'url(#arrow-path)')  // Gold arrow for path edges
          .style('filter', pathStyle.glow)
          .style('stroke-dasharray', null);  // No dashes
        break;

      case 'connected':
        const connectedStyle = highlights.connected.edge;
        edge
          .attr('stroke', connectedStyle.stroke)
          .attr('stroke-width', connectedStyle.strokeWidth)
          .attr('marker-end', 'url(#arrow-connected)')  // Purple arrow for connected edges
          .style('filter', null)
          .style('stroke-dasharray', null);  // No dashes for outbound
        break;

      case 'connected-inbound':
        // Inbound edges to head node - thinner and dashed
        const inboundStyle = highlights.connected.edge;
        edge
          .attr('stroke', inboundStyle.stroke)
          .attr('stroke-width', inboundStyle.strokeWidth)
          .attr('marker-end', 'url(#arrow-connected)')  // Purple arrow for inbound connected edges
          .style('filter', null)
          .style('stroke-dasharray', '10,5');  // Dashed for inbound
        break;
    }
  }

  /**
   * Apply highlight-based styling to a node (color, scale, glow)
   * @param {d3.Selection} node - D3 selection of the node
   * @param {string} state - Highlight state ('normal'|'path'|'head'|'connected')
   * @param {Object} nodeData - Node data for type-specific styling
   * @param {Object} styles - Styling configuration object
   */
  static applyHighlightStyleToNode(node, state, nodeData, styles) {
    const highlights = styles.highlights;
    const nodeColors = styles.nodeColors;
    const unknownText = styles.unknownText;

    // Get current position from transform
    const currentTransform = node.attr('transform') || 'translate(0,0)';
    const match = currentTransform.match(/translate\(([^,]+),([^)]+)\)/);
    const x = match ? parseFloat(match[1]) : 0;
    const y = match ? parseFloat(match[2]) : 0;

    switch (state) {
      case 'normal':
        // Reset to normal state
        node
          .attr('transform', `translate(${x},${y})`)
          .style('filter', null)
          .classed('highlighted', false);

        // Reset icon color
        const svgIcon = node.select('svg');
        if (!svgIcon.empty() && nodeData) {
          const nodeType = nodeData.data?.type || nodeData.type || 'Unknown';
          const defaultColor = nodeData.data?.color || nodeData.style?.fill || nodeColors[nodeType];
          svgIcon.style('color', defaultColor);

          // Handle Unknown node text
          if (nodeType === 'Unknown') {
            svgIcon.select('circle').attr('fill', defaultColor);
            svgIcon.select('text')
              .attr('fill', unknownText.normal.fill)
              .attr('font-weight', unknownText.normal.fontWeight);
          }
        }
        break;

      case 'path':
        const pathStyle = highlights.path.node;
        node
          .attr('transform', `translate(${x},${y}) scale(${pathStyle.scale})`)
          .style('filter', `drop-shadow(0 0 ${pathStyle.glowSize} ${pathStyle.glowColor})`)
          .classed('highlighted', true);

        HighlightingUtils.setNodeColor(node, pathStyle.color, nodeData, styles);
        break;

      case 'head':
        const headStyle = highlights.head;
        node
          .attr('transform', `translate(${x},${y}) scale(${headStyle.scale})`)
          .style('filter', `drop-shadow(0 0 ${headStyle.glowSize} ${headStyle.glowColor})`)
          .classed('highlighted', true);

        HighlightingUtils.setNodeColor(node, headStyle.color, nodeData, styles);
        break;

      case 'connected':
        const connectedStyle = highlights.connected.node;
        node
          .attr('transform', `translate(${x},${y}) scale(${connectedStyle.scale})`)
          .style('filter', `drop-shadow(0 0 ${connectedStyle.glowSize} ${connectedStyle.glowColor})`)
          .classed('highlighted', true);

        HighlightingUtils.setNodeColor(node, connectedStyle.color, nodeData, styles);
        break;
    }
  }

  /**
   * Helper to set node icon color
   */
  static setNodeColor(nodeSelection, color, nodeData, styles) {
    const svgIcon = nodeSelection.select('svg');
    if (!svgIcon.empty()) {
      svgIcon.style('color', color);

      // Handle Unknown node special styling
      if (nodeData && (nodeData.data?.type === 'Unknown' || nodeData.type === 'Unknown')) {
        svgIcon.select('circle').attr('fill', color);
        svgIcon.select('text')
          .attr('fill', styles.unknownText.highlighted.fill)
          .attr('font-weight', styles.unknownText.highlighted.fontWeight);
      }
    }
  }


  // ========================================================================
  // State Management
  // ========================================================================


  // ========================================================================
  // Core Highlighting Methods
  // ========================================================================

  /**
   * Handle node highlighting with selection logic
   * @param {Object} context - Highlighting context object
   * @param {string} nodeId - ID of the node to highlight
   * @param {boolean} appendToSelection - Whether to add to existing selection
   */
  static highlightNode(context, nodeId, appendToSelection = false) {
    console.log("GraphRenderer: Highlighting node", nodeId, "append =", appendToSelection);

    // Handle selection logic
    if (!appendToSelection) {
      // Fresh selection - clear everything
      HighlightingUtils.clearAllHighlights(context);
      HighlightingUtils.state.headNode = nodeId;
      HighlightingUtils.state.tracePath.nodes.clear();
      HighlightingUtils.state.tracePath.edges.clear();

    } else if (HighlightingUtils.state.headNode) {
      // Shift-click with existing selection
      const prevHead = HighlightingUtils.state.headNode;

      // Check if directly connected to previous head
      const directEdge = context.state.edges?.find(edge =>
        (edge.source === prevHead && edge.target === nodeId) ||
        (edge.source === nodeId && edge.target === prevHead)
      );

      if (directEdge) {
        // Connected - add to trace path
        const edgeKey = `${directEdge.source}-${directEdge.target}`;
        HighlightingUtils.state.tracePath.nodes.add(prevHead);
        HighlightingUtils.state.tracePath.nodes.add(nodeId);
        HighlightingUtils.state.tracePath.edges.add(edgeKey);
      }

      // Update head regardless of connection
      HighlightingUtils.state.headNode = nodeId;

    } else {
      // First selection
      HighlightingUtils.state.headNode = nodeId;
    }

    // Apply the visual highlighting
    HighlightingUtils.applyCleanHighlighting(context);
  }

  /**
   * Apply all highlights in correct order (path -> connections -> head)
   * @param {Object} context - Highlighting context object
   */
  static applyCleanHighlighting(context) {
    // First, clear everything
    HighlightingUtils.resetAllVisuals(context);

    // Apply in order: path -> head connections -> head
    // This ensures proper layering

    // 1. Apply golden trace path
    HighlightingUtils.applyPathHighlights(context);

    // 2. Apply purple head connections (excluding those in trace path)
    HighlightingUtils.applyConnectionHighlights(context);

    // 3. Apply head node highlight (overwrites if needed)
    if (HighlightingUtils.state.headNode) {
      HighlightingUtils.applyHeadHighlight(context, HighlightingUtils.state.headNode);
    }
  }

  // ========================================================================
  // Visual Reset Methods
  // ========================================================================

  /**
   * Reset all nodes and edges to their original visual state
   * @param {Object} context - Highlighting context object
   */
  static resetAllVisuals(context) {
    // Reset all nodes but preserve filter dimming
    if (context.dom.layers.nodeLayer) {
      context.dom.layers.nodeLayer.selectAll('.node').each(function(d) {
        const node = d3.select(this);

        // Reset to normal state (which automatically handles filter dimming)
        NodeUtils.applyNodeStyle(node, 'normal', d, STYLES, FilteringUtils.state.filteredOutNodes);
      });
    }

    // Reset all edges but preserve filter dimming
    if (context.dom.layers.edgeLayer) {
      context.dom.layers.edgeLayer.selectAll('.edge').each(function() {
        const edge = d3.select(this);
        // Store original values if not already stored
        if (!edge.attr('data-original-stroke')) {
          edge.attr('data-original-stroke', edge.attr('stroke'))
              .attr('data-original-stroke-width', edge.attr('stroke-width'));
        }

        // Reset to normal state (which automatically handles filter dimming)
        EdgeUtils.applyEdgeStyle(edge, 'normal', STYLES, FilteringUtils.state.filteredOutNodes);

        // Clear stored values after reset
        edge.attr('data-original-stroke', null)
            .attr('data-original-stroke-width', null);
      });
    }

    // Clear active highlights tracking
    HighlightingUtils.state.activeHighlights.nodes.clear();
    HighlightingUtils.state.activeHighlights.edges.clear();
  }

  /**
   * Clear ALL node and edge highlights completely
   * @param {Object} context - Highlighting context object
   */
  static clearAllHighlights(context) {
    // Clear ALL node highlights - restore everything to default
    if (context.dom.layers.nodeLayer) {
      context.dom.layers.nodeLayer.selectAll('.node').each(function(d) {
        const node = d3.select(this);

        // Clear original color storage
        node.attr('data-original-color', null);

        // Use unified styling - but ignore filter states (this is a complete clear)
        NodeUtils.applyNodeStyle(node, 'normal', d, STYLES, FilteringUtils.state.filteredOutNodes);
      });
    }

    // Clear ALL edge highlights - restore everything to default
    if (context.dom.layers.edgeLayer) {
      context.dom.layers.edgeLayer.selectAll('.edge').each(function() {
        const edge = d3.select(this);

        // Store original values if not already stored
        if (!edge.attr('data-original-stroke')) {
          edge.attr('data-original-stroke', edge.attr('stroke'))
              .attr('data-original-stroke-width', edge.attr('stroke-width'));
        }

        // Use unified styling
        EdgeUtils.applyEdgeStyle(edge, 'normal', STYLES, FilteringUtils.state.filteredOutNodes);

        // Clear stored values after reset
        edge.attr('data-original-stroke', null)
            .attr('data-original-stroke-width', null);
      });
    }
  }

  /**
   * Clear node highlights and reset state
   * @param {Object} context - Highlighting context object
   */
  static clearNodeHighlights(context) {
    // Clear state
    HighlightingUtils.state.headNode = null;
    HighlightingUtils.state.tracePath.nodes.clear();
    HighlightingUtils.state.tracePath.edges.clear();
    HighlightingUtils.state.activeHighlights.nodes.clear();
    HighlightingUtils.state.activeHighlights.edges.clear();

    // Reset all visuals
    HighlightingUtils.resetAllVisuals(context);
  }

  // ========================================================================
  // Path and Connection Highlighting
  // ========================================================================

  /**
   * Apply golden highlighting to trace path
   * @param {Object} context - Highlighting context object
   */
  static applyPathHighlights(context) {
    const tracePath = HighlightingUtils.state.tracePath;

    // Highlight path nodes
    tracePath.nodes.forEach(nodeId => {
      const node = context.dom.layers.nodeLayer.select(`#node-${nodeId}`);
      if (!node.empty()) {
        node.each(function(d) {
          NodeUtils.applyNodeStyle(d3.select(this), 'path', d, STYLES, FilteringUtils.state.filteredOutNodes);
        });
        HighlightingUtils.state.activeHighlights.nodes.set(nodeId, { type: 'path' });
      }
    });

    // Highlight path edges
    tracePath.edges.forEach(edgeKey => {
      context.dom.layers.edgeLayer.selectAll('.edge').each(function() {
        const edge = d3.select(this);
        const source = edge.attr('data-source');
        const target = edge.attr('data-target');
        const currentKey = `${source}-${target}`;

        if (currentKey === edgeKey) {
          // Store original values if not already stored
          if (!edge.attr('data-original-stroke')) {
            edge.attr('data-original-stroke', edge.attr('stroke'))
                .attr('data-original-stroke-width', edge.attr('stroke-width'));
          }
          EdgeUtils.applyEdgeStyle(edge, 'path', STYLES, FilteringUtils.state.filteredOutNodes);
          HighlightingUtils.state.activeHighlights.edges.set(edgeKey, { type: 'path' });
        }
      });
    });
  }

  /**
   * Apply purple highlighting to head connections
   * @param {Object} context - Highlighting context object
   */
  static applyConnectionHighlights(context) {
    // Only apply if we have a head node
    if (!HighlightingUtils.state.headNode) return;

    const { nodes: connectedNodes, edges: connectedEdges } =
      HighlightingUtils.getConnectedNodes(context, HighlightingUtils.state.headNode);

    // Filter out nodes/edges that are already in the trace path
    const connections = {
      nodes: new Set(),
      edges: new Set()
    };

    connectedNodes.forEach(nodeId => {
      if (!HighlightingUtils.state.tracePath.nodes.has(nodeId)) {
        connections.nodes.add(nodeId);
      }
    });

    connectedEdges.forEach(edgeKey => {
      if (!HighlightingUtils.state.tracePath.edges.has(edgeKey)) {
        connections.edges.add(edgeKey);
      }
    });

    // Highlight connected nodes
    connections.nodes.forEach(nodeId => {
      const node = context.dom.layers.nodeLayer.select(`#node-${nodeId}`);
      if (!node.empty()) {
        node.each(function(d) {
          NodeUtils.applyNodeStyle(d3.select(this), 'connected', d, STYLES, FilteringUtils.state.filteredOutNodes);
        });
        HighlightingUtils.state.activeHighlights.nodes.set(nodeId, { type: 'connected' });
      }
    });

    // Highlight connected edges
    connections.edges.forEach(edgeKey => {
      context.dom.layers.edgeLayer.selectAll('.edge').each(function() {
        const edge = d3.select(this);
        const source = edge.attr('data-source');
        const target = edge.attr('data-target');
        const currentKey = `${source}-${target}`;

        if (currentKey === edgeKey) {
          // Store original values if not already stored
          if (!edge.attr('data-original-stroke')) {
            edge.attr('data-original-stroke', edge.attr('stroke'))
                .attr('data-original-stroke-width', edge.attr('stroke-width'));
          }
          
          // Check if edge is inbound to the head node (target is head) or outbound (source is head)
          const isInbound = target === HighlightingUtils.state.headNode;
          const edgeType = isInbound ? 'connected-inbound' : 'connected';
          
          EdgeUtils.applyEdgeStyle(edge, edgeType, STYLES, FilteringUtils.state.filteredOutNodes);
          HighlightingUtils.state.activeHighlights.edges.set(edgeKey, { type: edgeType });
        }
      });
    });
  }

  /**
   * Apply highlighting to the head node
   * @param {Object} context - Highlighting context object
   * @param {string} nodeId - ID of the head node
   */
  static applyHeadHighlight(context, nodeId) {
    const node = context.dom.layers.nodeLayer.select(`#node-${nodeId}`);
    if (!node.empty()) {
      const isInPath = HighlightingUtils.state.tracePath.nodes.has(nodeId);
      node.each(function(d) {
        // Use 'path' style if node is in path, otherwise 'head'
        NodeUtils.applyNodeStyle(d3.select(this), isInPath ? 'path' : 'head', d, STYLES, FilteringUtils.state.filteredOutNodes);
      });
      HighlightingUtils.state.activeHighlights.nodes.set(nodeId, { type: 'head' });
    }
  }

  // ========================================================================
  // Single Node Operations
  // ========================================================================

  /**
   * Apply visual highlighting to a single node
   * @param {Object} context - Highlighting context object
   * @param {string} nodeId - Node ID to highlight
   * @param {boolean} isDirectlySelected - Whether this node is directly selected
   */
  static applyNodeHighlighting(context, nodeId, isDirectlySelected = true) {
    const nodeElement = context.dom.layers.nodeLayer.select(`#node-${nodeId}`);
    if (nodeElement.empty()) return;

    nodeElement.each(function(d) {
      const node = d3.select(this);
      // Use head style for directly selected, connected style otherwise
      NodeUtils.applyNodeStyle(node, isDirectlySelected ? 'head' : 'connected', d, STYLES, FilteringUtils.state.filteredOutNodes);
    });
  }

  /**
   * Remove visual highlighting from a single node
   * @param {Object} context - Highlighting context object
   * @param {string} nodeId - Node ID to unhighlight
   */
  static unhighlightNode(context, nodeId) {
    const nodeElement = context.dom.layers.nodeLayer.select(`#node-${nodeId}`);
    if (nodeElement.empty()) return;

    nodeElement.each(function(d) {
      const node = d3.select(this);
      NodeUtils.applyNodeStyle(node, 'normal', d, STYLES, FilteringUtils.state.filteredOutNodes);
    });
  }


  // ========================================================================
  // Application Group Selection
  // ========================================================================

  /**
   * Select/highlight all application groups with the same name
   * @param {Object} context - Highlighting context object
   * @param {string} appName - Name of the application to select
   * @param {boolean} appendToSelection - Whether to add to existing selection
   */
  static selectApplicationGroups(context, appName, appendToSelection = false) {
    console.log("GraphRenderer: Selecting application groups with name", appName);

    // Clear existing selection if not appending
    if (!appendToSelection) {
      HighlightingUtils.clearApplicationSelection(context);
    }

    // Track selected application names in our state
    if (!HighlightingUtils.state.selectedApplications) {
      HighlightingUtils.state.selectedApplications = new Set();
    }
    HighlightingUtils.state.selectedApplications.add(appName);

    // Find and highlight all application groups with the same name
    console.log('DEBUG: Looking for application groups with name:', appName);

    const allGroups = context.dom.layers.groupLayer.selectAll('circle.group');
    console.log('DEBUG: Total groups found:', allGroups.size());

    const appGroups = allGroups.filter(d => d.id.startsWith('app-'));
    console.log('DEBUG: App groups found:', appGroups.size());

    const matchingGroups = appGroups.filter(d => {
      // Extract app name from label: 'App: app-precise-framework (4 nodes)' -> 'app-precise-framework'
      const label = d.data.label || '';
      const match = label.match(/App: (.+?) \(/);
      const extractedAppName = match ? match[1] : null;
      return extractedAppName === appName;
    });
    console.log('DEBUG: Matching app groups:', matchingGroups.size());

    matchingGroups.each(function(d) {
        console.log('DEBUG: Highlighting group:', d.id, 'with data:', d.data);
        const group = d3.select(this);

        // Apply more dramatic orange halo with deeper colors
        group.style('filter', 'drop-shadow(0 0 12px #FF6600) drop-shadow(0 0 6px #FF9933)')
             .style('fill', '#FFD4A3')  // Softer orange fill (30% less intense than #FFB366)
             .style('fill-opacity', '0.8')  // Slightly more opaque
             .style('stroke-width', '4')  // Thicker stroke
             .style('stroke', '#FF6600')  // Keep the orange stroke
             .attr('r', d.r * 1.08)  // More noticeable enlargement
             .classed('app-highlighted', true);
      });

    // Also enhance the labels for highlighted application groups
    context.dom.layers.labelLayer.selectAll('g.group-label-container')
      .filter(d => {
        if (!d.id.startsWith('app-')) return false;
        // Extract app name from label using same pattern
        const label = d.data.label || '';
        const match = label.match(/App: (.+?) \(/);
        const extractedAppName = match ? match[1] : null;
        return extractedAppName === appName;
      })
      .each(function(d) {
        const labelContainer = d3.select(this);

        // Make the label text bigger and bolder
        const textElement = labelContainer.select('text.group-label')
          .style('font-size', '16px')  // Bigger font (was 12px for app groups)
          .style('font-weight', '900')  // Extra bold
          .style('fill', '#333');  // Keep black text

        // Get new text dimensions after size change
        const bbox = textElement.node().getBBox();

        // Update the label background to fit the larger text
        labelContainer.select('rect')
          .attr('x', -bbox.width/2 - 6)  // Add more padding for larger text
          .attr('y', -bbox.height/2 - 3)
          .attr('width', bbox.width + 12)
          .attr('height', bbox.height + 6)
          .style('fill', 'rgba(255, 255, 255, 0.95)')  // Brighter background
          .style('stroke', '#999')  // Keep original gray border
          .style('stroke-width', '1.5');  // Slightly thicker but not too much

        // Mark as highlighted for proper restoration
        labelContainer.classed('app-label-highlighted', true);
      });
  }

  /**
   * Clear application group selection
   * @param {Object} context - Highlighting context object
   */
  static clearApplicationSelection(context) {
    console.log("GraphRenderer: Clearing application group selection");

    // Restore original label styling
    context.dom.layers.labelLayer.selectAll('g.group-label-container.app-label-highlighted')
      .each(function(d) {
        const labelContainer = d3.select(this);
        const labelText = d.label || d.id;

        // Restore label text to original size
        const textElement = labelContainer.select('text.group-label')
          .style('font-size', '12px')  // Back to default for app groups
          .style('font-weight', 'bold')  // Back to normal bold
          .style('fill', '#555');  // Back to default color

        // Recalculate box size for restored text
        const bbox = textElement.node().getBBox();

        // Restore label background with correct size
        labelContainer.select('rect')
          .attr('x', -bbox.width/2 - 4)  // Original padding
          .attr('y', -bbox.height/2 - 2)
          .attr('width', bbox.width + 8)
          .attr('height', bbox.height + 4)
          .style('fill', 'rgba(240, 240, 245, 0.85)')  // Original background
          .style('stroke', '#999')  // Original border
          .style('stroke-width', '1');  // Original width

        // Remove highlighted class
        labelContainer.classed('app-label-highlighted', false);
      });

    // Clear our state
    if (HighlightingUtils.state.selectedApplications) {
      HighlightingUtils.state.selectedApplications.clear();
    }

    // Remove highlights from all application groups
    context.dom.layers.groupLayer.selectAll('circle.group.app-highlighted')
      .each(function(d) {
        const group = d3.select(this);

        // Restore original styling
        group.style('filter', null)
             .style('fill', null)  // Reset fill color
             .style('fill-opacity', null)  // Reset opacity
             .style('stroke-width', null)
             .style('stroke', null)
             .attr('r', d.r) // Reset to original radius
             .classed('app-highlighted', false);
      });
  }


  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Get connected nodes and edges for a given node
   * @param {Object} context - Highlighting context object
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
   * Clear all manual selection highlighting
   * @param {Object} context - Highlighting context object
   */
  static clearHighlight(context) {
    console.log("GraphRenderer: Clearing all manual selection highlights");

    // Clear node highlights using the clean system
    HighlightingUtils.clearNodeHighlights(context);

    // Clear application group highlights
    HighlightingUtils.clearApplicationSelection(context);
  }
}