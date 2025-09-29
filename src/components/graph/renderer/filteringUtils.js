/**
 * filteringUtils.js - Filtering and dimming utilities for GraphRenderer
 *
 * Contains utilities for node and edge filtering, dimming effects, and
 * visibility management used in network graph visualization. Includes
 * filter state management and visual feedback for filtered content.
 */

import * as d3 from 'd3';
import { InteractionUtils } from './interactionUtils.js';
import { HighlightingUtils } from './highlightingUtils.js';

export class FilteringUtils {
  /**
   * Internal filtering state
   */
  static state = {
    filteredOutNodes: new Set()  // Set of node IDs that don't match current filters
  };
  /**
   * Apply filter-based opacity to an edge
   * @param {d3.Selection} edge - D3 selection of the edge
   * @param {Set} filteredOutNodes - Set of filtered node IDs
   * @param {string} edgeState - Current edge state ('normal'|'path'|'connected'|'connected-inbound')
   */
  static applyFilterStyleToEdge(edge, filteredOutNodes, edgeState = 'normal') {
    if (!filteredOutNodes || filteredOutNodes.size === 0) {
      // No filtering - ensure opacity is not set
      edge.style('opacity', null);
      return;
    }

    // Get source and target from data attributes
    const source = edge.attr('data-source');
    const target = edge.attr('data-target');

    if (source && target) {
      const sourceFiltered = filteredOutNodes.has(source);
      const targetFiltered = filteredOutNodes.has(target);

      if (sourceFiltered || targetFiltered) {
        // Apply different opacity based on edge state
        // Path edges are less dimmed to preserve their importance
        const dimmedOpacity = edgeState === 'path' ? 0.6 : 0.2;
        edge.style('opacity', dimmedOpacity);
      } else {
        // Not filtered - ensure opacity is not set
        edge.style('opacity', null);
      }
    }
  }

  /**
   * Apply filter-based opacity to a node
   * @param {d3.Selection} node - D3 selection of the node
   * @param {string} nodeId - ID of the node
   * @param {Set} filteredOutNodes - Set of filtered node IDs
   */
  static applyFilterStyleToNode(node, nodeId, filteredOutNodes) {
    if (!nodeId || !filteredOutNodes || filteredOutNodes.size === 0) {
      // No filtering - ensure opacity is not set
      node.style('opacity', null);
      return;
    }

    if (filteredOutNodes.has(nodeId)) {
      // Apply dimmed opacity
      node.style('opacity', 0.2);
    } else {
      // Not filtered - ensure opacity is not set
      node.style('opacity', null);
    }
  }
  /**
   * Set filter-based dimming for nodes (dims non-matching nodes)
   * @param {Object} context - The graph context object
   * @param {Set} filteredOutNodeIds - Set of node IDs to dim (don't match filters)
   */
  static setFilterDimming(context, filteredOutNodeIds) {
    console.log("GraphRenderer: Setting filter dimming for", filteredOutNodeIds.size, "nodes");

    // Clear previous dimming
    const previousFilteredOutNodes = new Set(FilteringUtils.state.filteredOutNodes);

    // Update internal state
    FilteringUtils.state.filteredOutNodes = new Set(filteredOutNodeIds);

    // Remove dimming from nodes that are no longer filtered out
    previousFilteredOutNodes.forEach(nodeId => {
      if (!filteredOutNodeIds.has(nodeId)) {
        FilteringUtils.removeNodeDimming(context, nodeId);
      }
    });

    // Apply dimming to newly filtered out nodes
    filteredOutNodeIds.forEach(nodeId => {
      FilteringUtils.applyNodeDimming(context, nodeId);
    });

    // Apply edge dimming based on filtered out nodes
    if (filteredOutNodeIds.size > 0) {
      FilteringUtils.applyEdgeDimming(context);
    } else {
      FilteringUtils.removeEdgeDimming(context);
    }

    // Handle zoom behavior based on filter state
    InteractionUtils.handleFilterZoomBehavior(
      context, 
      filteredOutNodeIds.size, 
      previousFilteredOutNodes.size
    );
  }

  /**
   * Apply dimming effect to a node
   * @param {Object} context - GraphRenderer context
   * @param {string} nodeId - ID of the node to dim
   */
  static applyNodeDimming(context, nodeId) {
    // Find the node element
    context.dom.layers.nodeLayer.selectAll('.node')
      .filter(d => d.id === nodeId)
      .each(function(d) {
        const node = d3.select(this);
        node.classed('dimmed', true);
        FilteringUtils.applyFilterStyleToNode(node, nodeId, FilteringUtils.state.filteredOutNodes);
      });
  }

  /**
   * Remove dimming effect from a node
   * @param {Object} context - GraphRenderer context
   * @param {string} nodeId - ID of the node to un-dim
   */
  static removeNodeDimming(context, nodeId) {
    // Find the node element
    context.dom.layers.nodeLayer.selectAll('.node')
      .filter(d => d.id === nodeId)
      .each(function(d) {
        const node = d3.select(this);
        node.classed('dimmed', false);
        FilteringUtils.applyFilterStyleToNode(node, nodeId, new Set());
      });
  }

  /**
   * Apply dimming to edges connected to filtered out nodes
   * @param {Object} context - GraphRenderer context
   */
  static applyEdgeDimming(context) {
    if (!context.dom.layers.edgeLayer) return;

    // Re-apply current highlighting to ensure correct edge states with filter awareness
    // This ensures path edges maintain their 'path' state and get light dimming
    if (HighlightingUtils.state.headNode) {
      HighlightingUtils.applyCleanHighlighting(context);
    } else {
      // No active highlighting - apply filter styling to all edges as normal
      context.dom.layers.edgeLayer.selectAll('.edge').each(function() {
        const edge = d3.select(this);
        FilteringUtils.applyFilterStyleToEdge(edge, FilteringUtils.state.filteredOutNodes, 'normal');
      });
    }
  }

  /**
   * Remove dimming from all edges
   * @param {Object} context - GraphRenderer context
   */
  static removeEdgeDimming(context) {
    if (!context.dom.layers.edgeLayer) return;

    // Re-apply current highlighting to ensure correct edge states without filter dimming
    // This ensures path edges maintain their 'path' state and full opacity
    if (HighlightingUtils.state.headNode) {
      HighlightingUtils.applyCleanHighlighting(context);
    } else {
      // No active highlighting - remove filter styling from all edges
      context.dom.layers.edgeLayer.selectAll('.edge').each(function() {
        const edge = d3.select(this);
        FilteringUtils.applyFilterStyleToEdge(edge, new Set(), 'normal');
      });
    }
  }
}