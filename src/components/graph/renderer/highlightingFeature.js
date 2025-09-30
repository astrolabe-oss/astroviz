/**
 * Copyright 2025 Lightwire, LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as d3 from 'd3';
import { EdgeUtils } from './edgeUtils.js';

/**
 * HighlightingUtils - Utility class for handling graph highlighting logic
 *
 * This class manages highlighting state and provides methods for highlighting nodes,
 * edges, and groups in the graph visualization.
 */
export class HighlightingFeature {
    /**
     * Highlight styles configuration
     */
    static HIGHLIGHT_STYLES = {
        // Golden trace path
        path: {
            node: {
                scale: 1.2,
                color: '#FFA500',
                glowSize: '8px',
                glowColor: '#FFA500'
            },
            edge: {
                stroke: '#FFA500',
                strokeWidth: 5,
                opacity: 1,
                glow: 'drop-shadow(0 0 8px #FFA500)'
            }
        },
        // Head node (current selection)
        head: {
            scale: 1.2,
            color: '#8A4FBE',
            glowSize: '5px',
            glowColor: '#8A4FBE'
        },
        // Connected to head
        connected: {
            node: {
                scale: 1.1,
                color: '#A875D4',
                glowSize: '5px',
                glowColor: '#A875D4'
            },
            edge: {
                stroke: '#4444ff',
                strokeWidth: 3,
                opacity: 1
            }
        },
        // Dimmed (filtered out)
        dimmed: {
            opacity: 0.2
        }
    };

    /**
     * Unknown node text styles for highlighting
     */
    static UNKNOWN_TEXT_HIGHLIGHTED = {
        fill: '#FFFFFF',
        fontWeight: 'bolder'
    };

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

        // Application group selection
        selectedApplications: new Set()  // Set of selected application names
    };

  /**
   * Handle node highlighting with selection logic
   * @param {Object} context - Highlighting context object
   * @param {string} nodeId - ID of the node to highlight
   * @param {boolean} appendToSelection - Whether to add to existing selection
   */
  static updateSelectedNodes(context, nodeId, appendToSelection = false) {
    console.log("GraphRenderer: Highlighting node", nodeId, "append =", appendToSelection);

    // Handle selection logic
    if (!appendToSelection) {
      // Fresh selection - clear everything
      HighlightingFeature.state.headNode = nodeId;
      HighlightingFeature.state.tracePath.nodes.clear();
      HighlightingFeature.state.tracePath.edges.clear();

    } else if (HighlightingFeature.state.headNode) {
      // Shift-click with existing selection
      const prevHead = HighlightingFeature.state.headNode;

      // Check if directly connected to previous head
      const directEdge = context.state.edges?.find(edge =>
        (edge.source === prevHead && edge.target === nodeId) ||
        (edge.source === nodeId && edge.target === prevHead)
      );

      if (directEdge) {
        // Connected - add to trace path
        const edgeKey = `${directEdge.source}-${directEdge.target}`;
        HighlightingFeature.state.tracePath.nodes.add(prevHead);
        HighlightingFeature.state.tracePath.nodes.add(nodeId);
        HighlightingFeature.state.tracePath.edges.add(edgeKey);
      }

      // Update head regardless of connection
      HighlightingFeature.state.headNode = nodeId;

    } else {
      // First selection
      HighlightingFeature.state.headNode = nodeId;
    }
  }

  /**
   * Clear node highlights and reset state
   * @param {Object} context - Highlighting context object
   */
  static clearSelectedNodes() {
    // Clear state
    HighlightingFeature.state.headNode = null;
    HighlightingFeature.state.tracePath.nodes.clear();
    HighlightingFeature.state.tracePath.edges.clear();
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
    // Clear existing selection if not appending
    if (!appendToSelection) {
      HighlightingFeature.clearSelectedApplications();
    }

    console.log("GraphRenderer: Selecting application groups with name", appName);
    // Track selected application names in our state
    if (!HighlightingFeature.state.selectedApplications) {
      HighlightingFeature.state.selectedApplications = new Set();
    }
    HighlightingFeature.state.selectedApplications.add(appName);
    console.log("Current selected applications:", HighlightingFeature.state.selectedApplications);
  }

  /**
   * Clear application group selection
   * @param {Object} context - Highlighting context object
   */
  static clearSelectedApplications() {
    console.log("GraphRenderer: Clearing application group selection");

    // Clear selected application names from state
    if (HighlightingFeature.state.selectedApplications) {
      HighlightingFeature.state.selectedApplications.clear();
    }
  }


  // ========================================================================
  // Unified Rendering Pipeline Methods
  // ========================================================================

  /**
   * Apply highlighting styles to a node based on current state
   * Called by unified rendering pipeline (NodeUtils.styleAll)
   * @param {d3.Selection} node - D3 selection of the node element
   * @param {string} nodeId - Node ID
   * @param {Object} context - Rendering context
   */
  static nodePostRenderHook(node, nodeId, context) {
    if (!nodeId) return;

    // Determine if this node needs highlighting (null means no highlighting)
    let state = null;

    // Check if this node is in the trace path FIRST (path takes priority over head)
    if (HighlightingFeature.state.tracePath.nodes.has(nodeId)) {
      state = 'path';
    }
    // Check if this is the head node (but not in path)
    else if (HighlightingFeature.state.headNode === nodeId) {
      state = 'head';
    }
    // Check if this node is connected to the head
    else if (HighlightingFeature.state.headNode) {
      const connectedNodes = EdgeUtils.getConnectedNodes(context, HighlightingFeature.state.headNode);
      if (connectedNodes.nodes.has(nodeId)) {
        state = 'connected';
      }
    }

    // Only apply highlighting if there is highlighting
    if (state) {
      const nodeData = node.datum();
      HighlightingFeature.applyHighlightStyleToNode(node, state, nodeData);
    }
  }


  /**
   * Apply highlight-based styling to a node (color, scale, glow)
   * @param {d3.Selection} node - D3 selection of the node
   * @param {string} state - Highlight state ('normal'|'path'|'head'|'connected')
   * @param {Object} nodeData - Node data for type-specific styling
   */
  static applyHighlightStyleToNode(node, state, nodeData) {
    const highlights = HighlightingFeature.HIGHLIGHT_STYLES;

    // Get current position from transform
    const currentTransform = node.attr('transform') || 'translate(0,0)';
    const match = currentTransform.match(/translate\(([^,]+),([^)]+)\)/);
    const x = match ? parseFloat(match[1]) : 0;
    const y = match ? parseFloat(match[2]) : 0;

    switch (state) {
      case 'path':
        const pathStyle = highlights.path.node;
        node
          .attr('transform', `translate(${x},${y}) scale(${pathStyle.scale})`)
          .style('filter', `drop-shadow(0 0 ${pathStyle.glowSize} ${pathStyle.glowColor})`)
          .classed('highlighted', true);

        HighlightingFeature.setNodeColor(node, pathStyle.color, nodeData);
        break;

      case 'head':
        const headStyle = highlights.head;
        node
          .attr('transform', `translate(${x},${y}) scale(${headStyle.scale})`)
          .style('filter', `drop-shadow(0 0 ${headStyle.glowSize} ${headStyle.glowColor})`)
          .classed('highlighted', true);

        HighlightingFeature.setNodeColor(node, headStyle.color, nodeData);
        break;

      case 'connected':
        const connectedStyle = highlights.connected.node;
        node
          .attr('transform', `translate(${x},${y}) scale(${connectedStyle.scale})`)
          .style('filter', `drop-shadow(0 0 ${connectedStyle.glowSize} ${connectedStyle.glowColor})`)
          .classed('highlighted', true);

        HighlightingFeature.setNodeColor(node, connectedStyle.color, nodeData);
        break;
    }
  }

  /**
   * Helper to set node icon color
   */
  static setNodeColor(nodeSelection, color, nodeData) {
    const svgIcon = nodeSelection.select('svg');
    if (!svgIcon.empty()) {
      svgIcon.style('color', color);

      // Handle Unknown node special styling
      if (nodeData && (nodeData.data?.type === 'Unknown' || nodeData.type === 'Unknown')) {
        svgIcon.select('circle').attr('fill', color);
        svgIcon.select('text')
          .attr('fill', HighlightingFeature.UNKNOWN_TEXT_HIGHLIGHTED.fill)
          .attr('font-weight', HighlightingFeature.UNKNOWN_TEXT_HIGHLIGHTED.fontWeight);
      }
    }
  }

  /**
   * Apply highlighting styles to an edge based on current state
   * Called by unified rendering pipeline (EdgeUtils.styleAll)
   * @param {d3.Selection} edge - D3 selection of the edge element
   * @param {string} source - Source node ID
   * @param {string} target - Target node ID
   * @param {Object} context - Rendering context
   */
  static edgePostRenderHook(edge, source, target, context) {
    if (!source || !target) return;

    const edgeKey = `${source}-${target}`;

    // Check if this edge is in the golden trace path
    if (HighlightingFeature.state.tracePath.edges.has(edgeKey)) {
      const pathStyle = HighlightingFeature.HIGHLIGHT_STYLES.path.edge;
      edge.attr('stroke', pathStyle.stroke)
        .attr('stroke-width', pathStyle.strokeWidth)
        .attr('marker-end', 'url(#arrow-path)')
        .style('filter', pathStyle.glow);
      return;
    }

    // Check if this edge is connected to the currently selected head node
    if (HighlightingFeature.state.headNode) {
      if (source === HighlightingFeature.state.headNode || target === HighlightingFeature.state.headNode) {
        const connectedStyle = HighlightingFeature.HIGHLIGHT_STYLES.connected.edge;
        edge.attr('stroke', connectedStyle.stroke)
          .attr('stroke-width', connectedStyle.strokeWidth)
          .attr('marker-end', 'url(#arrow-connected)')
          .style('filter', null);
        return;
      }
    }
  }

  /**
   * Apply highlighting styles to groups and their labels (called by FeatureRegistry)
   * @param {d3.Selection} circle - D3 selection of the group circle element
   * @param {d3.Selection} labelContainer - D3 selection of the label container (or null)
   * @param {string} groupId - ID of the group
   * @param {Object} context - Rendering context
   */
  static groupPostRenderHook(circle, labelContainer, groupId, context) {
    // Only process application groups
    if (!groupId.startsWith('app-')) return;

    const groupData = circle.datum();
    const appState = HighlightingFeature.state.selectedApplications;
    const appGroupName = groupData.data?.app_name ?? null;

    // Check if this application group is selected
    const isHighlighted = appState && appState.size > 0 && appGroupName && appState.has(appGroupName);

    // If not highlighted, default styling is already applied by GroupUtils
    if (!isHighlighted) return;

    // Highlighted - apply styles to circle
    console.log("GraphRenderer: Highlighting application groups with name", appGroupName);
    circle
      .style('filter', 'drop-shadow(0 0 12px #FF6600) drop-shadow(0 0 6px #FF9933)')
      .style('fill', '#FFD4A3')
      .style('fill-opacity', '0.8')
      .style('stroke-width', '4')
      .style('stroke', '#FF6600')
      .attr('r', groupData.r * 1.08)
      .classed('app-highlighted', true);

    // Highlighted - apply styles to label
    if (labelContainer) {
      // Make the label text bigger and bolder
      const textElement = labelContainer.select('text.group-label')
        .style('font-size', '16px')
        .style('font-weight', '900')
        .style('fill', '#333');

      // Get new text dimensions after size change
      const bbox = textElement.node().getBBox();

      // Update the label background to fit the larger text
      labelContainer.select('rect')
        .attr('x', -bbox.width/2 - 6)
        .attr('y', -bbox.height/2 - 3)
        .attr('width', bbox.width + 12)
        .attr('height', bbox.height + 6)
        .style('fill', 'rgba(255, 255, 255, 0.95)')
        .style('stroke', '#999')
        .style('stroke-width', '1.5');

      labelContainer.classed('app-label-highlighted', true);
    }
  }
}