/**
 * filteringUtils.js - Filtering and dimming utilities for GraphRenderer
 *
 * Contains utilities for node and edge filtering, dimming effects, and
 * visibility management used in network graph visualization. Includes
 * filter state management and visual feedback for filtered content.
 */

import * as d3 from 'd3';
import { InteractionUtils } from './interactionUtils.js';

export class FilteringUtils {
  /**
   * Set filter-based dimming for nodes (dims non-matching nodes)
   * @param {Object} renderer - GraphRenderer instance
   * @param {Set} filteredOutNodeIds - Set of node IDs to dim (don't match filters)
   */
  static setFilterDimming(renderer, filteredOutNodeIds) {
    console.log("GraphRenderer: Setting filter dimming for", filteredOutNodeIds.size, "nodes");

    // Clear previous dimming
    const previousFilteredOutNodes = new Set(renderer.filteredOutNodes || []);
    renderer.filteredOutNodes = new Set(filteredOutNodeIds);

    // Remove dimming from nodes that are no longer filtered out
    previousFilteredOutNodes.forEach(nodeId => {
      if (!filteredOutNodeIds.has(nodeId)) {
        FilteringUtils.removeNodeDimming(renderer, nodeId);
      }
    });

    // Apply dimming to newly filtered out nodes
    filteredOutNodeIds.forEach(nodeId => {
      FilteringUtils.applyNodeDimming(renderer, nodeId);
    });

    // Apply edge dimming based on filtered out nodes
    if (filteredOutNodeIds.size > 0) {
      FilteringUtils.applyEdgeDimming(renderer);
    } else {
      FilteringUtils.removeEdgeDimming(renderer);
    }

    // Handle zoom behavior based on filter state
    if (filteredOutNodeIds.size > 0) {
      // Auto-zoom to visible nodes first
      setTimeout(() => {
        InteractionUtils.zoomToVisibleNodes(renderer);

        // Then trigger pulse animation after zoom completes
        setTimeout(() => {
          InteractionUtils.bounceAllNodes(renderer);
        }, 850);
      }, 100);
    } else if (previousFilteredOutNodes.size > 0 && filteredOutNodeIds.size === 0) {
      // Filters were cleared - reset the zoom view
      setTimeout(() => {
        InteractionUtils.resetView(renderer);
      }, 100);
    }
  }

  /**
   * Apply dimming effect to a node
   * @param {Object} renderer - GraphRenderer instance
   * @param {string} nodeId - ID of the node to dim
   */
  static applyNodeDimming(renderer, nodeId) {
    const self = renderer;

    // Find the node element
    renderer.nodeLayer.selectAll('.node')
      .filter(d => d.id === nodeId)
      .each(function(d) {
        const node = d3.select(this);
        node.classed('dimmed', true);
        self.applyNodeStyle(node, 'dimmed', d);
      });
  }

  /**
   * Remove dimming effect from a node
   * @param {Object} renderer - GraphRenderer instance
   * @param {string} nodeId - ID of the node to un-dim
   */
  static removeNodeDimming(renderer, nodeId) {
    const self = renderer;

    // Find the node element
    renderer.nodeLayer.selectAll('.node')
      .filter(d => d.id === nodeId)
      .each(function(d) {
        const node = d3.select(this);
        node.classed('dimmed', false);
        self.applyNodeStyle(node, 'normal', d);
      });
  }

  /**
   * Apply dimming to edges connected to filtered out nodes
   * @param {Object} renderer - GraphRenderer instance
   */
  static applyEdgeDimming(renderer) {
    if (!renderer.edgeLayer) return;

    const filteredOutNodes = renderer.filteredOutNodes; // Capture in closure

    // Apply dimming to edges where either endpoint is filtered out
    renderer.edgeLayer.selectAll('line.edge')
      .each(function(d) {
        const element = d3.select(this);

        // Get source and target from data attributes (more reliable)
        const source = element.attr('data-source');
        const target = element.attr('data-target');

        if (source && target) {
          const sourceFiltered = filteredOutNodes.has(source);
          const targetFiltered = filteredOutNodes.has(target);

          if (sourceFiltered || targetFiltered) {
            element
              .style('opacity', 0.4)
              .style('stroke-dasharray', '6,6');
          }
        }
      });
  }

  /**
   * Remove dimming from all edges
   * @param {Object} renderer - GraphRenderer instance
   */
  static removeEdgeDimming(renderer) {
    if (!renderer.edgeLayer) return;

    renderer.edgeLayer.selectAll('line.edge')
      .style('opacity', null)
      .style('stroke-dasharray', null);
  }
}