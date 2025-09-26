/**
 * groupUtils.js - Group rendering and interaction utilities for GraphRenderer
 *
 * Contains utilities for rendering group elements in the graph visualization,
 * including circles, labels, styling, and interaction behaviors.
 */

import * as d3 from 'd3';
import { InteractionUtils } from './interactionUtils.js';

/**
 * Supported style properties for group elements
 * Each property maps to an SVG attribute and has a default value
 */
const SUPPORTED_STYLES = {
  fill: { attr: 'fill', default: 'none' },
  stroke: { attr: 'stroke', default: '#5B8FF9' },
  strokeWidth: { attr: 'stroke-width', default: 2 },
  strokeDasharray: { attr: 'stroke-dasharray', default: null },
  opacity: { attr: 'opacity', default: 0.6 }
};

/**
 * Get default dash pattern based on node type/id
 */
function getDefaultDashPattern(vertex) {
  if (vertex.id.startsWith('app')) return '3,3';        // Short dash for apps
  if (vertex.id.startsWith('cluster')) return '8,4';     // Medium dash for clusters
  if (vertex.id === 'private-network') return '5,5';     // Default dash for private network
  return null;  // No dash for others
}

export class GroupUtils {
  /**
   * Main method to render all groups
   * @param {Object} context - Rendering context from GraphRenderer
   * @param {Object} packedRoot - D3 packed hierarchy root
   */
  static renderGroups(context, packedRoot) {
    const groups = Array.from(context.state.vertexMap.values())
      .filter(vertex => vertex.isGroup && !vertex.isVirtual);
    
    // Render group circles
    const groupElements = GroupUtils.renderGroupElements(context, groups);
    
    // Apply styles to groups
    GroupUtils.applyGroupStyles(groupElements);
    
    // Render group labels
    GroupUtils.renderGroupLabels(context, groups);
    
    // Attach interactions (click and drag)
    GroupUtils.attachGroupInteractions(context, groupElements);
  }
  
  /**
   * Render group circle elements
   * @param {Object} context - Rendering context
   * @param {Array} groups - Array of group vertices
   * @returns {d3.Selection} Selection of group elements
   */
  static renderGroupElements(context, groups) {
    const groupElements = context.layers.groupLayer
      .selectAll('circle.group')
      .data(groups, vertex => vertex.id)
      .join('circle')
      .attr('class', 'group')
      .attr('id', vertex => `group-${vertex.id}`)
      .attr('cx', vertex => vertex.x)
      .attr('cy', vertex => vertex.y)
      .attr('r', vertex => vertex.r)
      .style('cursor', 'grab')
      .on('click', (event, vertex) => {
        // Note: We need to access the handler through context
        if (context.ui && context.ui.handleGroupClick) {
          context.ui.handleGroupClick(event, vertex);
        }
      });
    
    return groupElements;
  }
  
  /**
   * Apply styles to group elements
   * @param {d3.Selection} groupElements - Selection of group elements
   */
  static applyGroupStyles(groupElements) {
    groupElements.each(function(d) {
      const element = d3.select(this);
      
      Object.entries(SUPPORTED_STYLES).forEach(([styleProp, config]) => {
        // Check for style in nested style object first, then fall back to legacy flat properties
        let value = d.style?.[styleProp] ?? d.data?.[styleProp] ?? config.default;
        
        // Special handling for strokeDasharray - use type-based defaults if not specified
        if (styleProp === 'strokeDasharray' && !value && !d.style?.strokeDasharray) {
          value = getDefaultDashPattern(d);
        }
        
        if (value !== null && value !== undefined) {
          element.attr(config.attr, value);
        }
      });
    });
  }
  
  /**
   * Render group labels with backgrounds
   * @param {Object} context - Rendering context
   * @param {Array} groups - Array of group vertices
   */
  static renderGroupLabels(context, groups) {
    const groupLabelElements = context.layers.labelLayer
      .selectAll('g.group-label-container')
      .data(groups, vertex => vertex.id)
      .join('g')
      .attr('class', 'group-label-container')
      .attr('id', vertex => `group-label-container-${vertex.id}`)
      .attr('transform', vertex => `translate(${vertex.x}, ${vertex.y - vertex.r - 5})`);

    // Add label backgrounds
    groupLabelElements.each(function(d) {
      const group = d3.select(this);

      // Remove prefixes from label text
      let labelText = d.label || d.id;
      if (labelText.startsWith('App: ')) {
        labelText = labelText.substring(5);
      } else if (labelText.startsWith('Cluster: ')) {
        labelText = labelText.substring(9);
      }

      // Get the group's fill color (same logic as group rendering)
      const groupFillColor = d.style?.fill ?? d.data?.fill ?? 'none';

      // Create temporary text to measure width
      const tempText = group.append('text')
        .attr('font-size', d.id === 'internet-boundary' || d.id === 'private-network' ? '16px' :
                          d.id.startsWith('cluster') ? '14px' : '12px')
        .attr('font-weight', 'bold')
        .text(labelText)
        .style('visibility', 'hidden');

      const bbox = tempText.node().getBBox();
      tempText.remove();

      // Add background rectangle with group's fill color
      group.append('rect')
        .attr('x', -bbox.width/2 - 4)
        .attr('y', -bbox.height/2 - 2)
        .attr('width', bbox.width + 8)
        .attr('height', bbox.height + 4)
        .attr('rx', 3)
        .attr('fill', groupFillColor !== 'none' ? groupFillColor : 'rgba(240, 240, 245, 0.85)')
        .attr('stroke', '#999')
        .attr('stroke-width', 1);

      // Add label text
      group.append('text')
        .attr('class', 'group-label')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-size', d.id === 'internet-boundary' || d.id === 'private-network' ? '16px' :
                           d.id.startsWith('cluster') ? '14px' : '12px')
        .style('font-weight', 'bold')
        .style('fill', d.id === 'internet-boundary' || d.id === 'private-network' ? '#333' : '#555')
        .style('pointer-events', 'none')
        .text(labelText);
    });
  }
  
  /**
   * Attach click and drag interactions to group elements
   * @param {Object} context - Rendering context
   * @param {d3.Selection} groupElements - Selection of group elements
   */
  static attachGroupInteractions(context, groupElements) {
    // Add drag behavior to groups with reasonable threshold
    const groupDragBehavior = d3.drag()
      .subject((event, d) => {
        // Initialize drag subject with current group position
        const pos = context.state.groupPositions.get(d.id);
        return pos ? { x: pos.x, y: pos.y } : { x: d.x, y: d.y };
      })
      .filter(event => !event.ctrlKey) // Allow ctrl+click to bypass drag for accessibility
      .clickDistance(5) // Require 5 pixels of movement before starting drag
      .on('start', (event, d) => InteractionUtils.onGroupDragStart(context, event, d))
      .on('drag', (event, d) => InteractionUtils.onGroupDrag(context, event, d))
      .on('end', (event, d) => InteractionUtils.onGroupDragEnd(context, event, d));
    
    groupElements.call(groupDragBehavior);
  }
}