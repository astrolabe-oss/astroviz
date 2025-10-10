/**
 * groupUtils.js - Group rendering and interaction utilities for GraphRenderer
 *
 * Contains utilities for rendering group elements in the graph visualization,
 * including circles, labels, styling, and interaction behaviors.
 */

import * as d3 from 'd3';
import { EdgeUtils } from './edgeUtils.js';
import { NodeUtils } from './nodeUtils.js';
import { FeatureRegistry } from './featureRegistry.js';

/**
 * Default fill color for groups and label backgrounds
 */
const GROUP_DEFAULT_FILL = 'rgba(240, 240, 245, 0.85)';

/**
 * Supported style properties for group elements
 * Each property maps to an SVG attribute and has a default value
 */
const GROUP_DEFAULT_STYLE = {
  filter: { attr: 'filter', default: null },
  fill: { attr: 'fill', default: GROUP_DEFAULT_FILL },
  stroke: { attr: 'stroke', default: '#5B8FF9' },
  strokeWidth: { attr: 'stroke-width', default: 2 },
  strokeDasharray: { attr: 'stroke-dasharray', default: null },
  opacity: { attr: 'opacity', default: 0.6 }
};

export class GroupUtils {
  /**
   * Group drag handlers
   */
  static setCursor(event, cursor) {
    d3.select(event.sourceEvent.target).style('cursor', cursor);
  }

  static onGroupDragStart(context, event, d) {
    // Prevent dragging the private network
    if (d.id === 'private-network') {
      event.sourceEvent.preventDefault();
      return;
    }

    GroupUtils.setCursor(event, 'grabbing');
  }

  static onGroupDrag(context, event, d) {
    const groupId = d.id;

    // Prevent dragging the private network
    if (groupId === 'private-network') {
      return;
    }

    const groupVertex = context.state.vertexMap.get(groupId);
    if (!groupVertex) return;

    // Calculate movement delta
    const deltaX = event.x - groupVertex.x;
    const deltaY = event.y - groupVertex.y;

    // Update the group position and move all children
    NodeUtils.moveGroupAndChildren(context, groupId, deltaX, deltaY);

    // Update all non-highlighted edges (async with cancellation)
    EdgeUtils.updateAllEdgesAsync(context);
  }

  static onGroupDragEnd(context, event, d) {
    GroupUtils.setCursor(event, 'grab');

    // Cancel any in-progress async update and do a final synchronous update
    EdgeUtils.cancelPendingUpdates();

    // Do a final edge update to ensure everything is accurate
    EdgeUtils.updateAllEdgesAsync(context);
  }

  /**
   * Main method to render all groups
   * @param {Object} context - Rendering context from GraphRenderer
   * @param {Function} handleGroupClick - Click handler for groups
   * @param {Function} handleGroupDoubleClick - Double-click handler for groups
   */
  static renderGroups(context, handleGroupClick, handleGroupDoubleClick) {
    const groups = Array.from(context.state.vertexMap.values())
      .filter(vertex => vertex.isGroup && !vertex.isVirtual && !vertex.isCollapsed);

    // Render group circles
    const groupElements = GroupUtils.renderGroupElements(context, groups, handleGroupClick, handleGroupDoubleClick);

    // Apply default styles to each group
    groupElements.each(function(d) {
      const group = d3.select(this);
      GroupUtils.applyGroupDefaultStyling(group, d);
    });

    // Render group labels
    GroupUtils.renderGroupLabels(context, groups);

    // Attach interactions (click and drag)
    GroupUtils.attachGroupInteractions(context, groupElements);
  }

  /**
   * Render group circle elements
   * @param {Object} context - Rendering context
   * @param {Array} groups - Array of group vertices
   * @param {Function} handleGroupClick - Click handler for groups
   * @param {Function} handleGroupDoubleClick - Double-click handler for groups
   * @returns {d3.Selection} Selection of group circle elements
   */
  static renderGroupElements(context, groups, handleGroupClick, handleGroupDoubleClick) {
    const groupElements = context.dom.layers.groupLayer
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
        if (handleGroupClick) {
          handleGroupClick(event, vertex);
        }
      })
      .on('dblclick', (event, vertex) => {
        if (handleGroupDoubleClick) {
          handleGroupDoubleClick(event, vertex);
        }
      });

    return groupElements;
  }

  /**
   * Get clean label text for a group (removes prefixes)
   * @param {Object} d - Group data
   * @returns {string} Cleaned label text
   */
  static getGroupLabelText(d) {
    let labelText = d.label || d.id;
    if (labelText.startsWith('App: ')) {
      return labelText.substring(5);
    } else if (labelText.startsWith('Cluster: ')) {
      return labelText.substring(9);
    }
    return labelText;
  }

  /**
   * Get appropriate font size for a group
   * @param {Object} d - Group data
   * @returns {string} Font size CSS value
   */
  static getGroupFontSize(d) {
    if (d.id === 'internet-boundary' || d.id === 'private-network') {
      return '16px';
    } else if (d.id.startsWith('cluster')) {
      return '14px';
    } else {
      return '12px';
    }
  }
  /**
   * Get appropriate text color for a group
   * @param {Object} d - Group data
   * @returns {string} Text color CSS value
   */
  static getGroupTextColor(d) {
    if (d.id === 'internet-boundary' || d.id === 'private-network') {
      return '#333';
    } else {
      return '#555';
    }
  }

  /**
   * Get fill color for a group
   * @param {Object} d - Group data
   * @returns {string} Fill color CSS value
   */
  static getGroupFillColor(d) {
    return d.style?.fill ?? GROUP_DEFAULT_FILL;
  }

  /**
   * Render/update a single group label with default styling
   * @param {d3.Selection} labelContainer - D3 selection of the label container
   * @param {Object} groupData - Group data object
   */
  static renderGroupLabel(labelContainer, groupData) {
    if (labelContainer.empty()) return;

    // Get label text
    const labelText = GroupUtils.getGroupLabelText(groupData);

    // Clear existing label content and rebuild
    labelContainer.selectAll('*').remove();

    // Create temporary text to measure width
    const tempText = labelContainer.append('text')
      .attr('font-size', GroupUtils.getGroupFontSize(groupData))
      .attr('font-weight', 'bold')
      .text(labelText)
      .style('visibility', 'hidden');

    const bbox = tempText.node().getBBox();
    tempText.remove();

    // Add background rectangle
    labelContainer.append('rect')
      .attr('x', -bbox.width/2 - 4)
      .attr('y', -bbox.height/2 - 2)
      .attr('width', bbox.width + 8)
      .attr('height', bbox.height + 4)
      .attr('rx', 3)
      .attr('fill', GroupUtils.getGroupFillColor(groupData))
      .attr('stroke', '#999')
      .attr('stroke-width', 1);

    // Add label text
    labelContainer.append('text')
      .attr('class', 'group-label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', GroupUtils.getGroupFontSize(groupData))
      .style('font-weight', 'bold')
      .style('fill', GroupUtils.getGroupTextColor(groupData))
      .style('pointer-events', 'none')
      .text(labelText);
  }

  /**
   * Render group labels with backgrounds (in labelLayer for proper z-index)
   * @param {Object} context - Rendering context
   * @param {Array} groups - Array of group vertices
   */
  static renderGroupLabels(context, groups) {
    // Render labels in the labelLayer (for z-index above edges)
    // But associate them with their group containers via data/id
    const groupLabelElements = context.dom.layers.labelLayer
      .selectAll('g.group-label-container')
      .data(groups, vertex => vertex.id)
      .join('g')
      .attr('class', 'group-label-container')
      .attr('id', vertex => `group-label-container-${vertex.id}`)
      .attr('transform', vertex => `translate(${vertex.x}, ${vertex.y - vertex.r - 5})`);

    // Render each label
    groupLabelElements.each(function(d) {
      GroupUtils.renderGroupLabel(d3.select(this), d);
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
        // Initialize drag subject with current group position from vertexMap
        const vertex = context.state.vertexMap.get(d.id);
        return vertex ? { x: vertex.x, y: vertex.y } : { x: d.x, y: d.y };
      })
      .filter(event => !event.ctrlKey) // Allow ctrl+click to bypass drag for accessibility
      .clickDistance(5) // Require 5 pixels of movement before starting drag
      .on('start', (event, d) => GroupUtils.onGroupDragStart(context, event, d))
      .on('drag', (event, d) => GroupUtils.onGroupDrag(context, event, d))
      .on('end', (event, d) => GroupUtils.onGroupDragEnd(context, event, d));

    groupElements.call(groupDragBehavior);
  }

  /**
   * Apply default styling to a single group element (resets to base state)
   * @param {d3.Selection} circle - D3 selection of the group circle
   * @param {Object} groupData - Group data object
   */
  static applyGroupDefaultStyling(circle, groupData) {
    // Reset to original radius
    if (groupData.r) {
      circle.attr('r', groupData.r);
    }

    // Apply all base styles from GROUP_DEFAULT_STYLE
    Object.entries(GROUP_DEFAULT_STYLE).forEach(([styleProp, config]) => {
      // Get value from data or use default
      const value = groupData.style?.[styleProp] ?? config.default;

      // Apply the style (null values will remove the inline style)
      circle.style(config.attr, value);
    });

    // Ensure cursor remains interactive
    circle.style('cursor', 'grab');
  }

  /**
   * Apply all feature styles to all groups
   * Called after any render operation or when only styles change
   * @param {Object} context - Rendering context
   */
  static renderGroupsWithHooks(context) {
    // Process each group circle
    context.dom.layers.groupLayer.selectAll('circle.group').each(function(d) {
      const circle = d3.select(this);
      const groupId = d.id || d.data?.id;

      // Reset circle to defaults
      GroupUtils.applyGroupDefaultStyling(circle, d);

      // Reset label using same render method as initial render
      const labelContainer = context.dom.layers.labelLayer.select(`#group-label-container-${groupId}`);
      GroupUtils.renderGroupLabel(labelContainer, d);

      // Let features apply their styles to both circle and label
      FeatureRegistry.groupPostRenderHooks(circle, labelContainer, groupId, context);
    });
  }
}