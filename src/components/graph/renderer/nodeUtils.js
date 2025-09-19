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

export class NodeUtils {
  /**
   * Store node positions from pack layout
   */
  static storeNodePositions(renderer, packedRoot) {
    renderer.nodePositions.clear();
    renderer.groupPositions.clear();

    // Store positions using our clean vertex structure
    renderer.vertexMap.forEach((vertex, id) => {
      if (!vertex.isVirtual) {
        const position = {
          x: vertex.x,
          y: vertex.y,
          originalX: vertex.x,
          originalY: vertex.y
        };

        if (vertex.isGroup) {
          position.r = vertex.r;
          position.originalR = vertex.r;
          position.children = vertex.children ? vertex.children.map(c => c.id) : [];
          renderer.groupPositions.set(vertex.id, position);
        } else {
          renderer.nodePositions.set(vertex.id, position);
        }
      }
    });
  }

  /**
   * Build hierarchy from vertices data
   */
  static buildHierarchy(renderer) {
    const vertices = renderer.data.vertices;
    if (!vertices) return null;

    console.log('Raw vertices data:', vertices);

    // Create vertex map with clean separation between app and database properties
    renderer.vertexMap = new Map();

    Object.entries(vertices).forEach(([id, vertex]) => {
      // Use the already properly structured data from graphTransformUtils
      renderer.vertexMap.set(id, {
        // Application properties (for visualization/interaction)
        id: vertex.id || id,
        children: [],
        isGroup: vertex.type === 'group',
        isVirtual: vertex.isVirtual || false,
        parentId: vertex.parentId,
        label: vertex.label,
        style: vertex.style,
        x: 0, y: 0, r: 0,    // Will be set from D3 positioning

        // Database properties (clean for end users) - already separated
        data: vertex.data || { label: vertex.label, type: vertex.type }  // Groups use minimal data
      });
    });

    // Build parent-child relationships
    Object.entries(vertices).forEach(([id, vertex]) => {
      if (vertex.parentId && renderer.vertexMap.has(vertex.parentId)) {
        const parent = renderer.vertexMap.get(vertex.parentId);
        const child = renderer.vertexMap.get(id);
        parent.children.push(child);
      }
    });

    // Find roots (nodes with no parentId)
    const roots = [];
    renderer.vertexMap.forEach(vertex => {
      if (!vertex.parentId) {
        roots.push(vertex);
      }
    });

    // Separate internet-boundary group from root leaf nodes for hybrid layout
    const internetBoundaryGroup = roots.find(node => node.id === 'internet-boundary');
    const rootLeafNodes = roots.filter(node => node.id !== 'internet-boundary' && !node.isGroup);
    const otherRootGroups = roots.filter(node => node.id !== 'internet-boundary' && node.isGroup);

    console.log(`Hierarchy separation: internet-boundary=${!!internetBoundaryGroup}, rootLeaves=${rootLeafNodes.length}, otherGroups=${otherRootGroups.length}`);

    // Store separation for hybrid layout calculation
    renderer.hybridLayout = {
      internetBoundaryGroup,
      rootLeafNodes,
      otherRootGroups
    };

    // For circle packing, exclude root leaf nodes - they'll be positioned radially
    const packedRoots = renderer.hybridLayout && renderer.hybridLayout.rootLeafNodes.length > 0
      ? roots.filter(node => node.id === 'internet-boundary' || node.isGroup)
      : roots;

    console.log(`Hierarchy for packing: ${packedRoots.length} roots (excluded ${roots.length - packedRoots.length} root leaf nodes)`);

    // Create virtual root if needed
    if (packedRoots.length === 1) {
      return packedRoots[0];
    } else {
      return {
        id: 'virtual-root',
        type: 'group',       // Use type instead of just isGroup
        children: packedRoots,
        isGroup: true,
        isVirtual: true
      };
    }
  }

  /**
   * Extract D3 positioning data back into our clean vertex structure
   */
  static extractPositionsFromD3(renderer, packedRoot) {
    packedRoot.descendants().forEach(d => {
      const vertex = renderer.vertexMap.get(d.data.id);
      if (vertex) {
        vertex.x = d.x + 25;  // Apply offset for margin
        vertex.y = d.y + 25;
        vertex.r = d.r;
      }
    });
  }

  /**
   * Render node icons
   */
  static renderNodes(renderer, packedRoot) {
    console.log('=== renderNodes called ===');
    const nodes = Array.from(renderer.vertexMap.values())
      .filter(vertex => !vertex.isGroup && !vertex.isVirtual);
    console.log('Found nodes:', nodes.length);

    // Create node elements to hold icons
    const nodeElements = renderer.nodeLayer
      .selectAll('g.node')
      .data(nodes, vertex => vertex.id)
      .join('g')
      .attr('class', 'node')
      .attr('id', vertex => `node-${vertex.id}`)
      .attr('transform', vertex => `translate(${vertex.x}, ${vertex.y})`)
      .style('cursor', 'grab')
      .on('click', (event, vertex) => {
        renderer.handleNodeClick(event, vertex);
      })
      .on('mouseover', (event, vertex) => {
        // Show tooltip on hover
        renderer.showTooltip(event, vertex.data);
      })
      .on('mouseout', () => {
        // Hide tooltip
        renderer.hideTooltip();
      });

    // Add icons to node elements (like the old GraphVisualization.vue)
    const self = renderer;
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
        const iconSize = self.options.nodeRadius * 1.6; // Make icons bigger for visibility

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
        // Initialize drag subject with current node position
        const pos = renderer.nodePositions.get(d.id);
        return pos ? { x: pos.x, y: pos.y } : { x: d.x + 25, y: d.y + 25 };
      })
      .filter(event => !event.ctrlKey) // Allow ctrl+click to bypass drag for accessibility
      .clickDistance(5) // Require 5 pixels of movement before starting drag
      .on('start', (event, d) => InteractionUtils.onDragStart(renderer, event, d))
      .on('drag', (event, d) => InteractionUtils.onDrag(renderer, event, d))
      .on('end', (event, d) => InteractionUtils.onDragEnd(renderer, event, d));

    console.log('Attaching drag behavior to', nodeElements.size(), 'node elements');
    nodeElements.call(dragBehavior);
    console.log('Drag behavior attached');
  }

  /**
   * Move a group and all its children by the given offset
   */
  static moveGroupAndChildren(renderer, groupId, deltaX, deltaY) {
    const groupPos = renderer.groupPositions.get(groupId);
    if (!groupPos) return;

    // Move the group itself
    groupPos.x += deltaX;
    groupPos.y += deltaY;

    // Update group visual position
    d3.select(`#group-${groupId}`)
      .attr('cx', groupPos.x)
      .attr('cy', groupPos.y);

    // Update group label container
    d3.select(`#group-label-container-${groupId}`)
      .attr('transform', `translate(${groupPos.x}, ${groupPos.y - groupPos.r - 5})`);

    // Move all child nodes and subgroups recursively
    groupPos.children.forEach(childId => {
      const childNodePos = renderer.nodePositions.get(childId);
      const childGroupPos = renderer.groupPositions.get(childId);

      if (childNodePos) {
        // Move child node
        childNodePos.x += deltaX;
        childNodePos.y += deltaY;

        // Update visual position
        d3.select(`#node-${childId}`)
          .attr('transform', `translate(${childNodePos.x}, ${childNodePos.y})`);


      } else if (childGroupPos) {
        // Recursively move child group
        NodeUtils.moveGroupAndChildren(renderer, childId, deltaX, deltaY);
      }
    });
  }

  /**
   * Reset all nodes and groups to their original pack layout positions
   */
  static resetNodePositions(renderer) {
    if (!renderer.nodePositions.size && !renderer.groupPositions.size) return;

    // Animate groups back to original positions
    renderer.groupPositions.forEach((pos, groupId) => {
      if (pos.originalX !== undefined && pos.originalY !== undefined) {
        // Update tracking position
        pos.x = pos.originalX;
        pos.y = pos.originalY;

        // Animate group back to original position
        d3.select(`#group-${groupId}`)
          .transition()
          .duration(500)
          .attr('cx', pos.originalX)
          .attr('cy', pos.originalY);

        // Animate group label container back to original position
        d3.select(`#group-label-container-${groupId}`)
          .transition()
          .duration(500)
          .attr('transform', `translate(${pos.originalX}, ${pos.originalY - pos.r - 5})`);
      }
    });

    // Animate nodes back to original positions
    renderer.nodePositions.forEach((pos, nodeId) => {
      if (pos.originalX !== undefined && pos.originalY !== undefined) {
        // Update tracking position
        pos.x = pos.originalX;
        pos.y = pos.originalY;

        // Animate node back to original position
        d3.select(`#node-${nodeId}`)
          .transition()
          .duration(500)
          .attr('transform', `translate(${pos.originalX}, ${pos.originalY})`);

      }
    });

    // Update all edges after a brief delay to let nodes animate
    setTimeout(() => {
      import('./edgeUtils.js').then(({ EdgeUtils }) => {
        EdgeUtils.updateAllEdgesAsync(renderer);
      });
    }, 100);
  }
}