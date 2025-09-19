/**
 * interactionUtils.js - Interaction and animation utilities for GraphRenderer
 *
 * Contains utilities for drag operations, zoom controls, event handling,
 * and animations used in network graph visualization. Includes cursor management,
 * node bouncing animations, and viewport controls.
 */

import * as d3 from 'd3';
import { EdgeUtils } from './edgeUtils.js';
import { NodeUtils } from './nodeUtils.js';
import { LayoutUtils } from './layoutUtils.js';

export class InteractionUtils {
  /**
   * Unified cursor management for drag operations
   */
  static setCursor(event, cursor) {
    d3.select(event.sourceEvent.target).style('cursor', cursor);
  }

  /**
   * Node drag handlers
   */
  static onDragStart(renderer, event, d) {
    console.log('=== onDragStart called ===', d.id);
    InteractionUtils.setCursor(event, 'grabbing');
  }

  static onDrag(renderer, event, d) {
    const nodeId = d.id;
    const nodePos = renderer.nodePositions.get(nodeId);
    if (!nodePos) return;

    // Update the subject position and use it for consistent coordinates
    event.subject.x = event.x;
    event.subject.y = event.y;

    // Update position tracking
    nodePos.x = event.x;
    nodePos.y = event.y;

    // Move the node group visually
    d3.select(`#node-${nodeId}`)
      .attr('transform', `translate(${event.x}, ${event.y})`);

    // Update all non-highlighted edges
    EdgeUtils.updateAllEdgesAsync(renderer);
  }

  static onDragEnd(renderer, event, d) {
    console.log('=== onDragEnd called ===');
    InteractionUtils.setCursor(event, 'grab');

    // Use unified pipeline like group drag end
    EdgeUtils.updateAllEdgesAsync(renderer);
  }

  /**
   * Group drag handlers
   */
  static onGroupDragStart(renderer, event, d) {
    console.log('=== onGroupDragStart called ===', d.id);

    // Prevent dragging the private network
    if (d.id === 'private-network') {
      event.sourceEvent.preventDefault();
      return;
    }

    InteractionUtils.setCursor(event, 'grabbing');
  }

  static onGroupDrag(renderer, event, d) {
    const groupId = d.id;

    // Prevent dragging the private network
    if (groupId === 'private-network') {
      return;
    }

    const groupPos = renderer.groupPositions.get(groupId);
    if (!groupPos) return;

    // Calculate movement delta
    const deltaX = event.x - groupPos.x;
    const deltaY = event.y - groupPos.y;

    // Update the group position and move all children
    NodeUtils.moveGroupAndChildren(renderer, groupId, deltaX, deltaY);
    EdgeUtils.updateAllEdgesAsync(renderer);
  }

  static onGroupDragEnd(renderer, event, d) {
    console.log('=== onGroupDragEnd called ===', d.id);
    InteractionUtils.setCursor(event, 'grab');

    // Cancel any in-progress async update and do a final synchronous update
    if (renderer.edgeUpdateController) {
      renderer.edgeUpdateController.cancelled = true;
      renderer.edgeUpdateController = null;
    }

    // Do a final edge update to ensure everything is accurate
    EdgeUtils.updateAllEdgesAsync(renderer);
  }

  /**
   * Zoom controls
   */
  static zoomIn(renderer) {
    if (!renderer.svg || !renderer.zoom) return;
    renderer.svg.transition().duration(300).call(
      renderer.zoom.scaleBy, 1.5
    );
  }

  static zoomOut(renderer) {
    if (!renderer.svg || !renderer.zoom) return;
    renderer.svg.transition().duration(300).call(
      renderer.zoom.scaleBy, 0.67
    );
  }

  static resetView(renderer) {
    if (!renderer.svg || !renderer.zoom) return;

    // Reset zoom and pan
    renderer.svg.transition().duration(500).call(
      renderer.zoom.transform,
      d3.zoomIdentity
    );

    // Reset all node positions to original
    NodeUtils.resetNodePositions(renderer);
    LayoutUtils.fitToView(renderer, renderer.hierarchyRoot);
  }

  /**
   * Get current zoom level
   */
  static getZoom(renderer) {
    if (!renderer.svg) return 1;
    return d3.zoomTransform(renderer.svg.node()).k;
  }

  /**
   * Zoom to bounds of visible (non-dimmed) nodes
   */
  static zoomToVisibleNodes(renderer) {
    if (!renderer.svg || !renderer.zoom || !renderer.nodeLayer) return;

    // Get bounds of all non-dimmed nodes
    const visibleNodes = [];
    renderer.nodeLayer.selectAll('.node')
      .filter(d => !renderer.filteredOutNodes.has(d.id))
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
    const svgNode = renderer.svg.node();
    const svgWidth = svgNode.clientWidth || svgNode.getBoundingClientRect().width;
    const svgHeight = svgNode.clientHeight || svgNode.getBoundingClientRect().height;

    // Calculate scale to fit bounds in view with maximum zoom limit
    const fullScale = Math.min(svgWidth / boundsWidth, svgHeight / boundsHeight);

    // Get current zoom level
    const currentZoom = InteractionUtils.getZoom(renderer);
    const maxZoom = currentZoom * 1.5; // Limit to 1.5x current zoom

    // Apply maximum zoom limit
    const scale = Math.min(fullScale, maxZoom);

    // Calculate translation to center bounds
    const translateX = svgWidth / 2 - scale * (boundsX + boundsWidth / 2);
    const translateY = svgHeight / 2 - scale * (boundsY + boundsHeight / 2);

    // Apply zoom transform
    renderer.svg.transition().duration(750).call(
      renderer.zoom.transform,
      d3.zoomIdentity.translate(translateX, translateY).scale(scale)
    );

    console.log(`Zoomed to ${visibleNodes.length} visible nodes at scale ${scale.toFixed(2)} (max: ${maxZoom.toFixed(2)})`);
  }

  /**
   * Animate all nodes with a bounce effect for dramatic filter feedback
   */
  static bounceAllNodes(renderer) {
    if (!renderer.nodeLayer) return;

    console.log('Bouncing visible nodes with shared physics simulation');

    // Collect only visible (non-filtered) nodes and their base transforms
    const nodeData = [];
    const self = renderer;
    renderer.nodeLayer.selectAll('.node')
      .each(function(d) {
        // Skip filtered out nodes - they should stay dimmed and not bounce
        if (self.filteredOutNodes && self.filteredOutNodes.has(d.id)) {
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

    // Start the pulse animation
    requestAnimationFrame(pulseStep);
  }
}