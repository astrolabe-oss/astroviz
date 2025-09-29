/**
 * nodeUtils.js - Node positioning and hierarchy utilities for GraphRenderer
 *
 * Contains utilities for node positioning, hierarchy building, and node rendering
 * used in network graph visualization. Includes D3 hierarchy management,
 * position tracking, and node styling.
 */

import * as d3 from 'd3';
import networkIcons from '../../networkIcons';
import { InteractionUtils } from './interactionUtils.js';
import { HighlightingUtils } from './highlightingUtils.js';
import { FilteringUtils } from './filteringUtils.js';
import { getOptions } from './options.js';

export class NodeUtils {
  /**
   * Unified node styling function - Orchestrates highlight and filter styling
   * @param {d3.Selection} nodeSelection - D3 selection of node(s) to style
   * @param {string} state - 'normal'|'path'|'head'|'connected'|'dimmed'
   * @param {Object} nodeData - Node data for type-specific styling
   * @param {Object} styling - Styling configuration object
   * @param {Set} filteredOutNodes - Set of filtered node IDs
   */
  static applyNodeStyle(nodeSelection, state, nodeData, styling, filteredOutNodes) {
    // Apply highlighting styles
    HighlightingUtils.applyHighlightStyleToNode(
      nodeSelection, 
      state, 
      nodeData, 
      styling
    );
    
    // Apply filtering styles
    const nodeId = nodeData?.id || nodeSelection.attr('id')?.replace('node-', '');
    FilteringUtils.applyFilterStyleToNode(
      nodeSelection,
      nodeId,
      filteredOutNodes
    );
  }
  /**
   * Store original positions in vertexMap for drag reset functionality
   */
  static storeOriginalPositions(context) {
    // Store original positions directly in vertexMap for reset functionality
    context.state.vertexMap.forEach((vertex, id) => {
      if (!vertex.isVirtual) {
        vertex.originalX = vertex.x;
        vertex.originalY = vertex.y;
        if (vertex.isGroup) {
          vertex.originalR = vertex.r;
        }
      }
    });
  }


  /**
   * Render node icons
   * @param {Object} context - Rendering context
   * @param {Function} handleNodeClick - Click handler for nodes
   */
  static renderNodes(context, handleNodeClick) {
    const nodes = Array.from(context.state.vertexMap.values())
      .filter(vertex => !vertex.isGroup && !vertex.isVirtual);

    // Create node elements to hold icons
    const nodeElements = context.dom.layers.nodeLayer
      .selectAll('g.node')
      .data(nodes, vertex => vertex.id)
      .join('g')
      .attr('class', 'node')
      .attr('id', vertex => `node-${vertex.id}`)
      .attr('transform', vertex => `translate(${vertex.x}, ${vertex.y})`)
      .style('cursor', 'grab')
      .on('click', (event, vertex) => {
        if (handleNodeClick) {
          handleNodeClick(event, vertex);
        }
      })
      .on('mouseover', (event, vertex) => {
        // Show tooltip on hover
        NodeUtils.showNodeTooltip(event, vertex.data);
      })
      .on('mouseout', () => {
        // Hide tooltip
        NodeUtils.hideNodeTooltip();
      });

    // Add icons to node elements (like the old GraphVisualization.vue)
    nodeElements.each(function(d) {
      const group = d3.select(this);

      // Node type is now directly accessible on d.data
      const nodeType = d.data?.type || 'Unknown';

      // Get the appropriate icon SVG (matching the old code exactly)
      const iconSvg = networkIcons[nodeType] || networkIcons.default;

      // Create temporary div to parse the SVG (same approach as old code)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = iconSvg;
      const svgElement = tempDiv.querySelector('svg');

      if (svgElement) {
        // Create SVG icon with appropriate size and color
        const iconSize = getOptions().nodeRadius * 1.6; // Make icons bigger for visibility

        const iconSvg = group.append('svg')
          .attr('class', 'node-icon')
          .attr('width', iconSize)
          .attr('height', iconSize)
          .attr('x', -iconSize / 2)
          .attr('y', -iconSize / 2)
          .attr('viewBox', svgElement.getAttribute('viewBox') || '0 0 24 24')
          .attr('preserveAspectRatio', 'xMidYMid meet')
          .style('color', d.style?.fill ?? '#5B8FF9'); // Use node color from style object

        // Insert the icon content
        iconSvg.html(svgElement.innerHTML);

        // Add public IP annotation if node has public IP
        if (d.data?.public_ip === true || d.data?.public_ip === 'true') {
          // Get the PublicIP icon SVG
          const publicIpIconSvg = networkIcons.PublicIP || networkIcons.default;

          // Create temporary div to parse the public IP icon SVG
          const publicIpTempDiv = document.createElement('div');
          publicIpTempDiv.innerHTML = publicIpIconSvg;
          const publicIpSvgElement = publicIpTempDiv.querySelector('svg');

          if (publicIpSvgElement) {
            // Create small cloud annotation in upper right corner
            const annotationSize = iconSize * 0.6; // Make annotation 50% of node icon size (bigger)
            const offsetX = iconSize * 0.05; // Position further left
            const offsetY = -iconSize * 0.5; // Position further to the top

            const publicIpAnnotation = group.append('svg')
              .attr('class', 'public-ip-annotation')
              .attr('width', annotationSize)
              .attr('height', annotationSize)
              .attr('x', offsetX)
              .attr('y', offsetY)
              .attr('viewBox', publicIpSvgElement.getAttribute('viewBox') || '0 0 24 24')
              .attr('preserveAspectRatio', 'xMidYMid meet')
              .style('color', '#E0E0E0') // Light gray for the cloud
              .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))'); // Add subtle shadow

            // Insert the public IP icon content
            publicIpAnnotation.html(publicIpSvgElement.innerHTML);
          }
        }
      }
    });


    // Add drag behavior with reasonable threshold to prevent accidental drags during clicks
    const dragBehavior = d3.drag()
      .subject((event, d) => {
        // Initialize drag subject with current node position from vertexMap
        const vertex = context.state.vertexMap.get(d.id);
        return vertex ? { x: vertex.x, y: vertex.y } : { x: d.x + 25, y: d.y + 25 };
      })
      .filter(event => !event.ctrlKey) // Allow ctrl+click to bypass drag for accessibility
      .clickDistance(5) // Require 5 pixels of movement before starting drag
      .on('start', (event, d) => InteractionUtils.onDragStart(context, event, d))
      .on('drag', (event, d) => InteractionUtils.onDrag(context, event, d))
      .on('end', (event, d) => InteractionUtils.onDragEnd(context, event, d));

    nodeElements.call(dragBehavior);
  }

  /**
   * Move a group and all its children by the given offset
   */
  static moveGroupAndChildren(context, groupId, deltaX, deltaY) {
    const groupVertex = context.state.vertexMap.get(groupId);
    if (!groupVertex || !groupVertex.isGroup) return;

    // Move the group itself
    groupVertex.x += deltaX;
    groupVertex.y += deltaY;

    // Update group visual position
    d3.select(`#group-${groupId}`)
      .attr('cx', groupVertex.x)
      .attr('cy', groupVertex.y);

    // Update group label container
    d3.select(`#group-label-container-${groupId}`)
      .attr('transform', `translate(${groupVertex.x}, ${groupVertex.y - groupVertex.r - 5})`);

    // Move all child nodes and subgroups recursively
    if (groupVertex.children) {
      groupVertex.children.forEach(child => {
        const childVertex = context.state.vertexMap.get(child.id);
        if (!childVertex) return;

        if (childVertex.isGroup) {
          // Recursively move child group
          NodeUtils.moveGroupAndChildren(context, child.id, deltaX, deltaY);
        } else {
          // Move child node
          childVertex.x += deltaX;
          childVertex.y += deltaY;

          // Update visual position
          d3.select(`#node-${child.id}`)
            .attr('transform', `translate(${childVertex.x}, ${childVertex.y})`);
        }
      });
    }
  }

  /**
   * Reset all nodes and groups to their original pack layout positions
   */
  static resetNodePositions(context) {
    if (!context.state.vertexMap.size) return;

    // Animate all vertices back to original positions
    context.state.vertexMap.forEach((vertex, id) => {
      if (vertex.originalX !== undefined && vertex.originalY !== undefined) {
        // Update tracking position
        vertex.x = vertex.originalX;
        vertex.y = vertex.originalY;

        if (vertex.isGroup) {
          vertex.r = vertex.originalR;

          // Animate group back to original position
          d3.select(`#group-${id}`)
            .transition()
            .duration(500)
            .attr('cx', vertex.originalX)
            .attr('cy', vertex.originalY);

          // Animate group label container back to original position
          d3.select(`#group-label-container-${id}`)
            .transition()
            .duration(500)
            .attr('transform', `translate(${vertex.originalX}, ${vertex.originalY - vertex.r - 5})`);
        } else {
          // Animate node back to original position
          d3.select(`#node-${id}`)
            .transition()
            .duration(500)
            .attr('transform', `translate(${vertex.originalX}, ${vertex.originalY})`);
        }
      }
    });

    // Update all edges after a brief delay to let nodes animate
    setTimeout(() => {
      import('./edgeUtils.js').then(({ EdgeUtils }) => {
        EdgeUtils.updateAllEdgesAsync(context);
      });
    }, 100);
  }

  /**
   * Show tooltip on node hover
   * @param {Event} event - Mouse event
   * @param {Object} nodeData - Node data object
   */
  static showNodeTooltip(event, nodeData) {
    // Create tooltip if it doesn't exist
    if (!NodeUtils.tooltip) {
      NodeUtils.tooltip = d3.select('body')
        .append('div')
        .attr('class', 'graph-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.8)')
        .style('color', 'white')
        .style('padding', '8px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('z-index', '9999')
        .style('opacity', 0);
    }

    // Build tooltip content
    let content = `Type: ${nodeData.type || 'Unknown'}`;
    if (nodeData.name) {
      content += `\nName: ${nodeData.name}`;
    }
    if (nodeData.address) {
      content += `\nAddress: ${nodeData.address}`;
    }

    // Show tooltip with content
    NodeUtils.tooltip
      .html(content.replace(/\n/g, '<br>'))
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 10) + 'px')
      .style('opacity', 1);
  }

  /**
   * Hide node tooltip
   */
  static hideNodeTooltip() {
    if (NodeUtils.tooltip) {
      NodeUtils.tooltip.style('opacity', 0);
    }
  }
}