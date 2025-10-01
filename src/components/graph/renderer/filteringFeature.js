/**
 * filteringUtils.js - Filtering and dimming utilities for GraphRenderer
 *
 * Contains utilities for node and edge filtering, dimming effects, and
 * visibility management used in network graph visualization. Includes
 * filter state management and visual feedback for filtered content.
 */

import * as d3 from 'd3';

export class FilteringFeature {
  /**
   * Internal filtering state
   */
  static state = {
    filteredOutNodes: new Set()  // Set of node IDs that don't match current filters
  };

  /**
   * Set filter-based dimming for nodes (dims non-matching nodes)
   * @param {Object} context - The graph context object
   * @param {Set} filteredOutNodeIds - Set of node IDs to dim (don't match filters)
   */
  static updateFilteredNodes(context, filteredOutNodeIds) {
    console.log("GraphRenderer: Setting filter dimming for", filteredOutNodeIds.size, "nodes");

    // Update internal state
    FilteringFeature.state.filteredOutNodes = new Set(filteredOutNodeIds);
  }


  // ========================================================================
  // Unified Rendering Pipeline Methods
  // ========================================================================

  /**
   * Apply filter styles to a node based on current state
   * Called by unified rendering pipeline (NodeUtils.styleAll)
   * @param {d3.Selection} node - D3 selection of the node element
   * @param {string} nodeId - Node ID
   * @param {Object} context - Rendering context (unused but kept for consistency)
   */
  static nodePostRenderHook(node, nodeId, context) {
    if (!nodeId) return;

    // Check if filtering is active and this node is filtered out
    if (FilteringFeature.state.filteredOutNodes && FilteringFeature.state.filteredOutNodes.has(nodeId)) {
      // Apply dimming
      node.style('opacity', 0.2);
      node.classed('dimmed', true);
    } else {
      // Remove dimming
      node.style('opacity', null);
      node.classed('dimmed', false);
    }
  }

  /**
   * Apply filter styles to an edge based on current state
   * Called by unified rendering pipeline (EdgeUtils.styleAll)
   * @param {d3.Selection} edge - D3 selection of the edge element
   * @param {string} source - Source node ID
   * @param {string} target - Target node ID
   * @param {Object} context - Rendering context (unused but kept for consistency)
   */
  static edgePostRenderHook(edge, source, target, context) {
    if (!source || !target) return;

    // Check if filtering is active
    if (!FilteringFeature.state.filteredOutNodes || FilteringFeature.state.filteredOutNodes.size === 0) {
      // No filtering - ensure opacity is not set
      edge.style('opacity', null);
      return;
    }

    // Check if either endpoint is filtered
    const sourceFiltered = FilteringFeature.state.filteredOutNodes.has(source);
    const targetFiltered = FilteringFeature.state.filteredOutNodes.has(target);

    if (sourceFiltered || targetFiltered) {
      // Dim edges connected to filtered nodes
      edge.style('opacity', 0.2);
    } else {
      // Not filtered - ensure full opacity
      edge.style('opacity', null);
    }
  }

  // ========================================================================
  // Filter Zoom and Animation Behavior
  // ========================================================================

  /**
   * Handle zoom and animation behavior when filters change
   * @param {Object} context - GraphRenderer context
   */
  static zoomAndBounce(context) {
      setTimeout(() => {
        FilteringFeature.zoomToFilteredView(context);

        // Then trigger pulse animation after zoom completes
        setTimeout(() => {
          FilteringFeature.bounceVisibleNodes(context);
        }, 850);
      }, 100);
  }

  /**
   * Zoom to bounds of visible (non-filtered) nodes
   * @param {Object} context - GraphRenderer context
   */
  static zoomToFilteredView(context) {
    if (!context.dom.svg || !context.dom.zoom || !context.dom.layers.nodeLayer) return;

    console.log('DEBUG: filteredOutNodes:', FilteringFeature.state.filteredOutNodes?.size, Array.from(FilteringFeature.state.filteredOutNodes || []));

    // Get bounds of all non-dimmed nodes
    const visibleNodes = [];
    context.dom.layers.nodeLayer.selectAll('.node')
      .filter(d => !FilteringFeature.state.filteredOutNodes || !FilteringFeature.state.filteredOutNodes.has(d.id))
      .each(function(d) {
        const node = d3.select(this);
        const transform = node.attr('transform');
        if (transform) {
          const translate = transform.match(/translate\(([^)]+)\)/);
          if (translate) {
            const coords = translate[1].split(',');
            const x = parseFloat(coords[0]);
            const y = parseFloat(coords[1]);
            visibleNodes.push({ x, y, r: d.r || 15 });
          }
        }
      });

    if (visibleNodes.length === 0) {
      console.log('No visible nodes to zoom to');
      return;
    }

    // Calculate bounds with padding
    const padding = 50;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    visibleNodes.forEach(node => {
      minX = Math.min(minX, node.x - node.r);
      maxX = Math.max(maxX, node.x + node.r);
      minY = Math.min(minY, node.y - node.r);
      maxY = Math.max(maxY, node.y + node.r);
    });

    const boundsWidth = maxX - minX + 2 * padding;
    const boundsHeight = maxY - minY + 2 * padding;
    const boundsX = minX - padding;
    const boundsY = minY - padding;

    // Get current SVG dimensions
    const svgNode = context.dom.svg.node();
    const svgWidth = svgNode.clientWidth || svgNode.getBoundingClientRect().width;
    const svgHeight = svgNode.clientHeight || svgNode.getBoundingClientRect().height;

    // Calculate scale to fit bounds in view with maximum zoom limit
    const fullScale = Math.min(svgWidth / boundsWidth, svgHeight / boundsHeight);

    // Get current zoom level
    const currentZoom = FilteringFeature.getCurrentZoom(context);
    const maxZoom = currentZoom * 1.5; // Limit to 1.5x current zoom

    // Apply maximum zoom limit
    const scale = Math.min(fullScale, maxZoom);

    // Calculate translation to center bounds
    const translateX = svgWidth / 2 - scale * (boundsX + boundsWidth / 2);
    const translateY = svgHeight / 2 - scale * (boundsY + boundsHeight / 2);

    // Apply zoom transform
    context.dom.svg.transition().duration(750).call(
      context.dom.zoom.transform,
      d3.zoomIdentity.translate(translateX, translateY).scale(scale)
    );

    console.log(`Zoomed to ${visibleNodes.length} visible nodes at scale ${scale.toFixed(2)} (max: ${maxZoom.toFixed(2)}):`);
    console.log(`  Bounds: ${boundsWidth.toFixed(0)}x${boundsHeight.toFixed(0)} at (${boundsX.toFixed(0)}, ${boundsY.toFixed(0)})`);
    console.log(`  SVG: ${svgWidth.toFixed(0)}x${svgHeight.toFixed(0)}, fullScale: ${fullScale.toFixed(2)}, currentZoom: ${currentZoom.toFixed(2)}`);
  }

  /**
   * Animate visible (non-filtered) nodes with a bounce effect
   * @param {Object} context - GraphRenderer context
   */
  static bounceVisibleNodes(context) {
    if (!context.dom.layers.nodeLayer) return;

    console.log('Bouncing visible nodes with shared physics simulation');

    // Collect only visible (non-filtered) nodes and their base transforms
    const nodeData = [];
    context.dom.layers.nodeLayer.selectAll('.node')
      .each(function(d) {
        // Skip filtered out nodes - they should stay dimmed and not bounce
        if (FilteringFeature.state.filteredOutNodes && FilteringFeature.state.filteredOutNodes.has(d.id)) {
          return;
        }

        const node = d3.select(this);
        const currentTransform = node.attr('transform') || 'translate(0,0)';
        const translate = currentTransform.match(/translate\(([^)]+)\)/);
        let baseTransform = currentTransform;

        if (translate) {
          const coords = translate[1].split(',');
          const x = parseFloat(coords[0]);
          const y = parseFloat(coords[1]);
          baseTransform = `translate(${x},${y})`;
        }

        nodeData.push({ node, baseTransform });
      });

    if (nodeData.length === 0) return;

    // Pulse animation - time-based for consistency
    let currentPulse = 0;
    const totalPulses = 2;
    const pulseDuration = 500; // milliseconds per pulse
    const pauseBetweenPulses = 150; // milliseconds
    let pulseStartTime = null;

    const pulseStep = (timestamp) => {
      if (!pulseStartTime) pulseStartTime = timestamp;

      const elapsed = timestamp - pulseStartTime;
      const pulsePhase = Math.min(elapsed / pulseDuration, 1.0); // 0 to 1 progress

      // Calculate scale using sine wave for smooth pulse
      let scale;
      if (pulsePhase < 1.0) {
        // Smooth expansion and contraction using sine
        const sineValue = Math.sin(pulsePhase * Math.PI);
        scale = 1.0 + (sineValue * 0.3); // Pulse between 1.0 and 1.3
      } else {
        // Pulse complete
        scale = 1.0;
        currentPulse++;
        pulseStartTime = null; // Reset for next pulse

        // Check if all pulses are done
        if (currentPulse >= totalPulses) {
          // Final update to ensure scale is exactly 1.0
          nodeData.forEach(({ node, baseTransform }) => {
            node.attr('transform', baseTransform + ' scale(1)');
          });
          return;
        }

        // Small pause between pulses
        setTimeout(() => {
          requestAnimationFrame(pulseStep);
        }, pauseBetweenPulses);
        return;
      }

      // Apply current scale to all visible nodes simultaneously
      nodeData.forEach(({ node, baseTransform }) => {
        node.attr('transform', baseTransform + ` scale(${scale})`);
      });

      requestAnimationFrame(pulseStep);
    };

    // Start animation
    requestAnimationFrame(pulseStep);
  }


  /**
   * Get current zoom level (helper for zoom calculations)
   * @param {Object} context - GraphRenderer context
   * @returns {number} Current zoom scale
   */
  static getCurrentZoom(context) {
    if (!context.dom.svg) return 1;
    return d3.zoomTransform(context.dom.svg.node()).k;
  }
}