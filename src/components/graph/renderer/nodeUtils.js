/**
 * nodeUtils.js - Node positioning and hierarchy utilities for GraphRenderer
 *
 * Contains utilities for node positioning, hierarchy building, and node rendering
 * used in network graph visualization. Includes D3 hierarchy management,
 * position tracking, and node styling.
 */

import * as d3 from 'd3';
import networkIcons from '../../networkIcons';
import { EdgeUtils } from './edgeUtils.js';
import { GroupUtils } from './groupUtils.js';
import { FeatureRegistry } from './featureRegistry.js';
import { getOptions } from './options.js';

export class NodeUtils {
  /**
   * Node type base colors
   */
  static NODE_COLORS = {
    'Application': '#F9696E',
    'Deployment': '#F2A3B3',
    'Compute': '#5DCAD1',
    'Resource': '#74B56D',
    'TrafficController': '#4A98E3',
    'Unknown': '#F9C96E'
  };

  /**
   * Unknown node text styles (normal state)
   */
  static UNKNOWN_TEXT_NORMAL = {
    fill: '#333333',
    fontWeight: 'normal'
  };

  /**
   * Recursively count all descendants in a children array
   * @param {Array} children - Array of child objects
   * @returns {number} Total count of all descendants
   */
  static countDescendants(children) {
    if (!children || !Array.isArray(children) || children.length === 0) return 0;

    let count = children.length;
    children.forEach(child => {
      if (child.children && Array.isArray(child.children)) {
        count += NodeUtils.countDescendants(child.children);
      }
    });
    return count;
  }

  /**
   * Node drag handlers
   */
  static setCursor(event, cursor) {
    d3.select(event.sourceEvent.target).style('cursor', cursor);
  }

  static onDragStart(context, event, d) {
    console.log('DEBUG: onDragStart fired for', d.id);
    NodeUtils.setCursor(event, 'grabbing');
  }

  static onDrag(context, event, d) {
    const nodeId = d.id;
    const vertex = context.state.vertexMap.get(nodeId);
    if (!vertex) return;

    // Update the subject position and use it for consistent coordinates
    event.subject.x = event.x;
    event.subject.y = event.y;

    // Update position tracking directly in vertexMap
    vertex.x = event.x;
    vertex.y = event.y;

    // Move the node group visually
    d3.select(`#node-${nodeId}`)
      .attr('transform', `translate(${event.x}, ${event.y})`);

    // Update all non-highlighted edges (async with cancellation)
    EdgeUtils.updateAllEdgesAsync(context);
  }

  static onDragEnd(context, event, d) {
    console.log('DEBUG: onDragEnd fired for', d.id);
    NodeUtils.setCursor(event, 'grab');

    // Use unified pipeline like group drag end
    EdgeUtils.updateAllEdgesAsync(context);
  }

  /**
   * Render node icons
   * @param {Object} context - Rendering context
   * @param {Function} handleNodeClick - Click handler for nodes
   */
  static renderNodes(context, handleNodeClick, handleNodeDoubleClick) {
    const nodes = Array.from(context.state.vertexMap.values())
      .filter(vertex => (!vertex.isGroup || vertex.isCollapsed) && !vertex.isVirtual);

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
      .on('dblclick', (event, vertex) => {
        if (handleNodeDoubleClick) {
          handleNodeDoubleClick(event, vertex);
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

      // Check if this is a collapsed group - render as circle instead of icon
      if (d.isCollapsed) {
        // Render as small dashed circle (matching legend Application style)
        const radius = 30;
        group.append('circle')
          .attr('class', 'collapsed-group-circle')
          .attr('r', radius)
          .attr('fill', '#FFE6CC')
          .attr('fill-opacity', 0.8)
          .attr('stroke', '#FF9933')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '3,3');

        // Apply default styling
        NodeUtils.applyNodeDefaultStyling(group, d, true);
        return; // Skip icon rendering
      }

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
        const iconSize = getOptions().nodeRadius * 2.3; // Icon diameter = 2 * radius

        const iconSvg = group.append('svg')
          .attr('class', 'node-icon')
          .attr('width', iconSize)
          .attr('height', iconSize)
          .attr('x', -iconSize / 2)
          .attr('y', -iconSize / 2)
          .attr('viewBox', svgElement.getAttribute('viewBox') || '0 0 24 24')
          .attr('preserveAspectRatio', 'xMidYMid meet');

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

      // Apply default styling (colors only, preserve transform for initial render)
      NodeUtils.applyNodeDefaultStyling(group, d, true);
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
      .on('start', (event, d) => NodeUtils.onDragStart(context, event, d))
      .on('drag', (event, d) => NodeUtils.onDrag(context, event, d))
      .on('end', (event, d) => NodeUtils.onDragEnd(context, event, d));

    nodeElements.call(dragBehavior);

    // Render labels for collapsed groups (reuse group label rendering)
    const collapsedGroups = nodes.filter(vertex => vertex.isCollapsed);
    NodeUtils.renderCollapsedGroupLabels(context, collapsedGroups);
  }

  /**
   * Render labels and badges for collapsed groups
   * @param {Object} context - Rendering context
   * @param {Array} collapsedGroups - Array of collapsed group vertices
   */
  static renderCollapsedGroupLabels(context, collapsedGroups) {
    // Create label containers in labelLayer (same as GroupUtils.renderGroupLabels)
    const labelContainers = context.dom.layers.labelLayer
      .selectAll('g.collapsed-group-label-container')
      .data(collapsedGroups, vertex => vertex.id)
      .join('g')
      .attr('class', 'collapsed-group-label-container')
      .attr('id', vertex => `collapsed-group-label-${vertex.id}`)
      .attr('transform', vertex => `translate(${vertex.x}, ${vertex.y + vertex.r + 15})`); // Position below circle

    // Render each label using GroupUtils method (reuse existing logic)
    labelContainers.each(function(d) {
      GroupUtils.renderGroupLabel(d3.select(this), d);
    });

    // Add badges with child count
    collapsedGroups.forEach(group => {
      const childCount = NodeUtils.countDescendants(group.children);
      if (childCount > 0) {
        NodeUtils.renderCollapsedGroupBadge(context, group, childCount);
      }
    });
  }

  /**
   * Render badge with child count for a collapsed group
   * @param {Object} context - Rendering context
   * @param {Object} group - Collapsed group vertex
   * @param {number} count - Number of children
   */
  static renderCollapsedGroupBadge(context, group, count) {
    const badgeRadius = 10;
    const badgeX = group.r * 0.7;  // Top-right of circle
    const badgeY = -group.r * 0.7;

    // Badge group in labelLayer (for proper z-index)
    const badgeGroup = context.dom.layers.labelLayer
      .append('g')
      .attr('class', 'collapsed-group-badge-container')
      .attr('transform', `translate(${group.x + badgeX}, ${group.y + badgeY})`);

    // Badge background circle
    badgeGroup.append('circle')
      .attr('r', badgeRadius)
      .attr('fill', '#F9696E')  // Red for Application
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    // Badge count text
    badgeGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', 'white')
      .style('pointer-events', 'none')
      .text(count);
  }

  /**
   * Apply all default styling to a node (colors, transforms, classes)
   * @param {d3.Selection} node - D3 selection of the node element
   * @param {Object} nodeData - Node data object
   * @param {boolean} preserveTransform - If true, only sets colors (for initial render)
   */
  static applyNodeDefaultStyling(node, nodeData, preserveTransform = false) {
    // Reset transform, filter, and classes (unless initial render)
    if (!preserveTransform) {
      // Get current position and remove any scale transform
      const currentTransform = node.attr('transform') || 'translate(0,0)';
      const match = currentTransform.match(/translate\(([^,]+),([^)]+)\)/);
      const x = match ? parseFloat(match[1]) : 0;
      const y = match ? parseFloat(match[2]) : 0;

      node.attr('transform', `translate(${x},${y})`)
          .style('filter', null)
          .classed('highlighted', false);
    }

    // Apply default icon colors
    const nodeType = nodeData.data?.type || nodeData.type || 'Unknown';
    const defaultColor = nodeData.data?.color || nodeData.style?.fill || NodeUtils.NODE_COLORS[nodeType];

    const svgIcon = node.select('svg');
    if (!svgIcon.empty()) {
      svgIcon.style('color', defaultColor);
      if (nodeType === 'Unknown') {
        svgIcon.select('circle').attr('fill', defaultColor);
        svgIcon.select('text')
          .attr('fill', NodeUtils.UNKNOWN_TEXT_NORMAL.fill)
          .attr('font-weight', NodeUtils.UNKNOWN_TEXT_NORMAL.fontWeight);
      }
    }
  }

  /**
   * Apply all feature styles to all nodes
   * Called after any render operation or when only styles change
   * @param {Object} context - Rendering context
   */
  static renderNodesWithHooks(context) {
    context.dom.layers.nodeLayer.selectAll('.node').each(function(d) {
      const node = d3.select(this);
      const nodeId = d.id || d.data?.id;

      // Reset to defaults first (with transform reset)
      NodeUtils.applyNodeDefaultStyling(node, d, false);

      // Let all registered features apply their styles
      FeatureRegistry.nodePostRenderHooks(node, nodeId, context);
    });
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
      EdgeUtils.updateAllEdgesAsync(context);
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