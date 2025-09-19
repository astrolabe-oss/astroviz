import * as d3 from 'd3';
import networkIcons from '../../networkIcons';
import { EdgeUtils } from './edgeUtils.js';
import { NodeUtils } from './nodeUtils.js';
import { LayoutUtils } from './layoutUtils.js';
import { InteractionUtils } from './interactionUtils.js';

/**
 * Supported style properties for graph elements
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

/**
 * GraphRenderer - D3 hierarchical graph renderer with advanced edge styling
 * Renders vertices and edges with circle packing and complex edge interactions
 */
export class GraphRenderer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      width: options.width || 800,
      height: options.height || 600,
      nodePadding: options.nodePadding || 0,
      nodeRadius: options.nodeRadius || 25,
      groupPadding: options.groupPadding || 50,
      ...options
    };

    this.data = null;
    this.svg = null;
    this.g = null;

    // Track node positions for drag updates
    this.nodePositions = new Map(); // nodeId -> {x, y}

    // Track group positions and their children
    this.groupPositions = new Map(); // groupId -> {x, y, r, children: []}

    // Track async edge update for cancellation
    this.edgeUpdateController = null;

    // Selection and highlighting state - Clean architecture
    this.highlightState = {
      // Current selection state
      headNode: null,              // Most recently selected node (head of selection)
      tracePath: {                 // Golden path being traced
        nodes: new Set(),
        edges: new Set()
      },

      // Visual state tracking
      activeHighlights: {          // Currently highlighted elements
        nodes: new Map(),         // nodeId -> {type: 'head'|'connected'|'path', originalColor}
        edges: new Map()          // edgeKey -> {type: 'connected'|'path', originalStroke, originalWidth}
      }
    };

    // Legacy state (to be phased out)
    this.selectedNodeIds = new Set();
    this.filterHighlightedNodes = new Set();
    this.filteredOutNodes = new Set();
    this.highlightedElements = {
      nodes: new Set(),
      edgeKeys: new Set()
    };

    // Centralized styling configuration - Single source of truth
    this.styling = {
      // Node type base colors
      nodeColors: {
        'Application': '#F9696E',
        'Deployment': '#F2A3B3',
        'Compute': '#5DCAD1',
        'Resource': '#74B56D',
        'TrafficController': '#4A98E3',
        'Unknown': '#F9C96E'
      },

      // Highlight states styling
      highlights: {
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
      },

      // Unknown node special text styling
      unknownText: {
        highlighted: {
          fill: '#FFFFFF',
          fontWeight: 'bolder'
        },
        normal: {
          fill: '#333333',
          fontWeight: 'normal'
        }
      }
    };

    this.init();
  }

  /**
   * Unified node styling function - Single source of truth for all node styling
   * @param {d3.Selection} nodeSelection - D3 selection of node(s) to style
   * @param {string} state - 'normal'|'path'|'head'|'connected'|'dimmed'
   * @param {Object} nodeData - Node data for type-specific styling
   */
  applyNodeStyle(nodeSelection, state, nodeData = null) {
    const styles = this.styling.highlights;

    // Get current position from transform
    const currentTransform = nodeSelection.attr('transform') || 'translate(0,0)';
    const match = currentTransform.match(/translate\(([^,]+),([^)]+)\)/);
    const x = match ? parseFloat(match[1]) : 0;
    const y = match ? parseFloat(match[2]) : 0;

    switch (state) {
      case 'normal':
        // Reset to normal state
        nodeSelection
          .attr('transform', `translate(${x},${y})`)
          .style('filter', null)
          .style('opacity', null)
          .classed('highlighted', false);

        // Reset icon color
        const svgIcon = nodeSelection.select('svg');
        if (!svgIcon.empty() && nodeData) {
          const nodeType = nodeData.data?.type || nodeData.type || 'Unknown';
          const defaultColor = nodeData.data?.color || nodeData.style?.fill || this.styling.nodeColors[nodeType];
          svgIcon.style('color', defaultColor);

          // Handle Unknown node text
          if (nodeType === 'Unknown') {
            svgIcon.select('circle').attr('fill', defaultColor);
            svgIcon.select('text')
              .attr('fill', this.styling.unknownText.normal.fill)
              .attr('font-weight', this.styling.unknownText.normal.fontWeight);
          }
        }
        break;

      case 'path':
        const pathStyle = styles.path.node;
        nodeSelection
          .attr('transform', `translate(${x},${y}) scale(${pathStyle.scale})`)
          .style('filter', `drop-shadow(0 0 ${pathStyle.glowSize} ${pathStyle.glowColor})`)
          .style('opacity', null)
          .classed('highlighted', true);

        this.setNodeColor(nodeSelection, pathStyle.color, nodeData);
        break;

      case 'head':
        const headStyle = styles.head;
        nodeSelection
          .attr('transform', `translate(${x},${y}) scale(${headStyle.scale})`)
          .style('filter', `drop-shadow(0 0 ${headStyle.glowSize} ${headStyle.glowColor})`)
          .style('opacity', null)
          .classed('highlighted', true);

        this.setNodeColor(nodeSelection, headStyle.color, nodeData);
        break;

      case 'connected':
        const connectedStyle = styles.connected.node;
        nodeSelection
          .attr('transform', `translate(${x},${y}) scale(${connectedStyle.scale})`)
          .style('filter', `drop-shadow(0 0 ${connectedStyle.glowSize} ${connectedStyle.glowColor})`)
          .style('opacity', null)
          .classed('highlighted', true);

        this.setNodeColor(nodeSelection, connectedStyle.color, nodeData);
        break;

      case 'dimmed':
        nodeSelection.style('opacity', styles.dimmed.opacity);
        break;
    }
  }

  /**
   * Helper to set node icon color
   */
  setNodeColor(nodeSelection, color, nodeData) {
    const svgIcon = nodeSelection.select('svg');
    if (!svgIcon.empty()) {
      svgIcon.style('color', color);

      // Handle Unknown node special styling
      if (nodeData && (nodeData.data?.type === 'Unknown' || nodeData.type === 'Unknown')) {
        svgIcon.select('circle').attr('fill', color);
        svgIcon.select('text')
          .attr('fill', this.styling.unknownText.highlighted.fill)
          .attr('font-weight', this.styling.unknownText.highlighted.fontWeight);
      }
    }
  }

  /**
   * Unified edge styling function - Single source of truth for all edge styling
   * @param {d3.Selection} edgeSelection - D3 selection of edge(s) to style
   * @param {string} state - 'normal'|'path'|'connected'|'dimmed'
   */
  applyEdgeStyle(edgeSelection, state) {
    const styles = this.styling.highlights;

    switch (state) {
      case 'normal':
        // Get stored original values or use defaults
        const originalStroke = edgeSelection.attr('data-original-stroke') || '#999';
        const originalWidth = edgeSelection.attr('data-original-stroke-width') || '1';

        edgeSelection
          .attr('stroke', originalStroke)
          .attr('stroke-width', originalWidth)
          .style('opacity', null)
          .style('filter', null)
          .style('stroke-dasharray', null);
        break;

      case 'path':
        const pathStyle = styles.path.edge;
        edgeSelection
          .attr('stroke', pathStyle.stroke)
          .attr('stroke-width', pathStyle.strokeWidth)
          .style('opacity', pathStyle.opacity)
          .style('filter', pathStyle.glow)
          .style('stroke-dasharray', null);
        break;

      case 'connected':
        const connectedStyle = styles.connected.edge;
        edgeSelection
          .attr('stroke', connectedStyle.stroke)
          .attr('stroke-width', connectedStyle.strokeWidth)
          .style('opacity', connectedStyle.opacity)
          .style('filter', null)
          .style('stroke-dasharray', null);
        break;

      case 'dimmed':
        edgeSelection.style('opacity', styles.dimmed.opacity);
        break;
    }
  }

  /**
   * Get the default color for a node type
   */
  getNodeDefaultColor(nodeData) {
    const nodeType = nodeData?.data?.type || nodeData?.type || 'Unknown';
    return nodeData?.data?.color || nodeData?.style?.fill || this.styling.nodeColors[nodeType] || this.styling.nodeColors['Unknown'];
  }

  /**
   * Initialize SVG
   */
  init() {
    // Clear container
    d3.select(this.container).selectAll('*').remove();
    
    // Create SVG
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('id', 'graph-svg')
      .attr('width', this.options.width)
      .attr('height', this.options.height)
      .style('background', '#f8f9fa')
      .on('click', (event) => {
        // Clear highlights when clicking background (unless shift key is pressed)
        if (!event.shiftKey) {
          this.clearHighlight();
        }
      });
    
    // Add definitions for gradients and markers
    this.defs = this.svg.append('defs');
    
    // Create arrow marker definition (half size)
    const marker = this.defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 7)  // Position reference inside the arrow so tip extends past line
      .attr('refY', 5)
      .attr('markerWidth', 5)  // Half the original size
      .attr('markerHeight', 5)  // Half the original size
      .attr('orient', 'auto-start-reverse');
    
    marker.append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', '#888')  // Match the solid gradient color
      .attr('opacity', 1.0);  // Fully opaque to avoid double-darkness where it overlaps line
    
    // Main group for zooming/panning
    this.g = this.svg.append('g');

    // Add zoom behavior
    this.zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);

        // Emit zoom change event if callback is provided
        if (this.options.onZoomChange) {
          this.options.onZoomChange(event.transform.k);
        }
      });
    
    this.svg.call(this.zoom);
    
    // Create layers (order determines z-index: groups behind edges behind nodes behind labels)
    this.groupLayer = this.g.append('g').attr('class', 'groups');
    this.edgeLayer = this.g.append('g').attr('class', 'edges');
    this.nodeLayer = this.g.append('g').attr('class', 'nodes');
    this.labelLayer = this.g.append('g').attr('class', 'labels');
  }
  
  /**
   * Set data and render
   */
  setData(data) {
    this.data = data;
    this.render();
  }
  
  /**
   * Main render method
   */
  render() {
    if (!this.data) return;
    
    // Build hierarchy from vertices (stores vertexMap as class property)
    const hierarchy = NodeUtils.buildHierarchy(this);
    if (!hierarchy) return;

    // Calculate positions using D3 pack
    const packedRoot = LayoutUtils.calculatePack(this, hierarchy);
    if (!packedRoot) return;

    // Extract D3 positioning back to our vertex structure
    NodeUtils.extractPositionsFromD3(this, packedRoot);

    // Store the packed root for later use (e.g., drag end re-rendering)
    this.hierarchyRoot = packedRoot;

    // Store node positions for drag updates
    NodeUtils.storeNodePositions(this, packedRoot);

    // Render everything
    this.renderGroups(packedRoot);
    NodeUtils.renderNodes(this, packedRoot);
    EdgeUtils.renderEdges(this, packedRoot);
    
    // Fit the drawing to viewport on initial render
    LayoutUtils.fitToView(this, packedRoot);
  }
  

  

  

  
  
  /**
   * Render group circles
   */
  renderGroups(packedRoot) {
    const groups = Array.from(this.vertexMap.values())
      .filter(vertex => vertex.isGroup && !vertex.isVirtual);
    
    const groupElements = this.groupLayer
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
        this.handleGroupClick(event, vertex);
      });
    
    // Apply all supported styles from the style object
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
    
    // Group labels with backgrounds (like old D3 force styling) - moved to label layer
    const groupLabelElements = this.labelLayer
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
    
    // Add drag behavior to groups with reasonable threshold
    const groupDragBehavior = d3.drag()
      .subject((event, d) => {
        // Initialize drag subject with current group position
        const pos = this.groupPositions.get(d.id);
        return pos ? { x: pos.x, y: pos.y } : { x: d.x, y: d.y };
      })
      .filter(event => !event.ctrlKey) // Allow ctrl+click to bypass drag for accessibility
      .clickDistance(5) // Require 5 pixels of movement before starting drag
      .on('start', (event, d) => InteractionUtils.onGroupDragStart(this, event, d))
      .on('drag', (event, d) => InteractionUtils.onGroupDrag(this, event, d))
      .on('end', (event, d) => InteractionUtils.onGroupDragEnd(this, event, d));
    
    groupElements.call(groupDragBehavior);
  }
  
  


  

  
  
  



  /**
   * Get connected nodes and edges for a given node ID
   * @param {string} nodeId - ID of the node to find connections for
   * @returns {Object} - Object with connected nodes Set and edge keys Array
   */
  getConnectedNodes(nodeId) {
    const connectedNodes = new Set([nodeId]); // Include the node itself
    const connectedEdges = [];

    if (!this.data.edges) return { nodes: connectedNodes, edges: connectedEdges };

    this.data.edges.forEach((edge) => {
      if (edge.source === nodeId) {
        connectedNodes.add(edge.target);
        connectedEdges.push(`${edge.source}-${edge.target}`);
      } else if (edge.target === nodeId) {
        connectedNodes.add(edge.source);
        connectedEdges.push(`${edge.source}-${edge.target}`);
      }
    });

    return { nodes: connectedNodes, edges: connectedEdges };
  }

  /**
   * Find shortest path between two nodes using BFS
   * @param {string} startNodeId - Starting node ID
   * @param {string} endNodeId - Target node ID
   * @returns {Object} - {nodes: Array, edges: Array} representing the path
   */

  /**
   * Clean highlight system - handle node selection
   * @param {string} nodeId - ID of the node to highlight
   * @param {boolean} appendToSelection - Whether to add to existing selection (shift-click)
   */
  highlightNode(nodeId, appendToSelection = false) {
    console.log("GraphRenderer: Highlighting node", nodeId, "append =", appendToSelection);

    // Handle selection logic
    if (!appendToSelection) {
      // Fresh selection - clear everything
      this.clearAllHighlights();
      this.highlightState.headNode = nodeId;
      this.highlightState.tracePath.nodes.clear();
      this.highlightState.tracePath.edges.clear();

    } else if (this.highlightState.headNode) {
      // Shift-click with existing selection
      const prevHead = this.highlightState.headNode;

      // Check if directly connected to previous head
      const directEdge = this.data.edges?.find(edge =>
        (edge.source === prevHead && edge.target === nodeId) ||
        (edge.source === nodeId && edge.target === prevHead)
      );

      if (directEdge) {
        // Connected - add to trace path
        const edgeKey = `${directEdge.source}-${directEdge.target}`;
        this.highlightState.tracePath.nodes.add(prevHead);
        this.highlightState.tracePath.nodes.add(nodeId);
        this.highlightState.tracePath.edges.add(edgeKey);
      }

      // Update head regardless of connection
      this.highlightState.headNode = nodeId;

    } else {
      // First selection
      this.highlightState.headNode = nodeId;
    }

    // Apply the visual highlighting
    this.applyCleanHighlighting();

    // Update legacy state for compatibility
    this.selectedNodeIds.clear();
    this.selectedNodeIds.add(nodeId);
  }

  /**
   * Clean visual application - apply all highlights in correct order
   */
  applyCleanHighlighting() {
    // First, clear everything
    this.resetAllVisuals();

    // Apply in order: path -> head connections -> head
    // This ensures proper layering

    // 1. Apply golden trace path
    this.applyPathHighlights();

    // 2. Apply purple head connections (excluding those in trace path)
    this.applyConnectionHighlights();

    // 3. Apply head node highlight (overwrites if needed)
    if (this.highlightState.headNode) {
      this.applyHeadHighlight(this.highlightState.headNode);
    }
  }

  /**
   * Reset all nodes and edges to their original visual state, preserving filter states
   */
  resetAllVisuals() {
    // Reset all nodes but preserve filter dimming
    if (this.nodeLayer) {
      const self = this;
      this.nodeLayer.selectAll('.node').each(function(d) {
        const node = d3.select(this);

        // Check if this node should stay dimmed due to filtering
        const isFilteredOut = self.filteredOutNodes && self.filteredOutNodes.has(d.id);

        if (isFilteredOut) {
          // Reset to normal first, then apply dimming
          self.applyNodeStyle(node, 'normal', d);
          self.applyNodeStyle(node, 'dimmed', d);
        } else {
          self.applyNodeStyle(node, 'normal', d);
        }
      });
    }

    // Reset all edges but preserve filter dimming
    if (this.edgeLayer) {
      const self = this;
      this.edgeLayer.selectAll('.edge').each(function() {
        const edge = d3.select(this);
        // Store original values if not already stored
        if (!edge.attr('data-original-stroke')) {
          edge.attr('data-original-stroke', edge.attr('stroke'))
              .attr('data-original-stroke-width', edge.attr('stroke-width'));
        }

        // Check if this edge should stay dimmed due to filtering
        const source = edge.attr('data-source');
        const target = edge.attr('data-target');
        const sourceFiltered = self.filteredOutNodes && self.filteredOutNodes.has(source);
        const targetFiltered = self.filteredOutNodes && self.filteredOutNodes.has(target);
        const shouldBeDimmed = sourceFiltered || targetFiltered;

        if (shouldBeDimmed) {
          // Reset to normal first, then apply dimming
          self.applyEdgeStyle(edge, 'normal');
          self.applyEdgeStyle(edge, 'dimmed');
        } else {
          self.applyEdgeStyle(edge, 'normal');
        }

        // Clear stored values after reset
        edge.attr('data-original-stroke', null)
            .attr('data-original-stroke-width', null);
      });
    }

    // Clear active highlights tracking
    this.highlightState.activeHighlights.nodes.clear();
    this.highlightState.activeHighlights.edges.clear();
  }

  /**
   * Apply golden highlighting to trace path
   */
  applyPathHighlights() {
    const tracePath = this.highlightState.tracePath;
    const self = this;

    // Highlight path nodes
    tracePath.nodes.forEach(nodeId => {
      const node = this.nodeLayer.select(`#node-${nodeId}`);
      if (!node.empty()) {
        node.each(function(d) {
          self.applyNodeStyle(d3.select(this), 'path', d);
        });
        this.highlightState.activeHighlights.nodes.set(nodeId, { type: 'path' });
      }
    });

    // Highlight path edges
    tracePath.edges.forEach(edgeKey => {
      this.edgeLayer.selectAll('.edge').each(function() {
        const edge = d3.select(this);
        const source = edge.attr('data-source');
        const target = edge.attr('data-target');
        const currentKey = `${source}-${target}`;

        if (currentKey === edgeKey) {
          // Store original values if not already stored
          if (!edge.attr('data-original-stroke')) {
            edge.attr('data-original-stroke', edge.attr('stroke'))
                .attr('data-original-stroke-width', edge.attr('stroke-width'));
          }
          self.applyEdgeStyle(edge, 'path');
          self.highlightState.activeHighlights.edges.set(edgeKey, { type: 'path' });
        }
      });
    });
  }

  /**
   * Apply purple highlighting to head connections
   */
  applyConnectionHighlights() {
    // Only apply if we have a head node
    if (!this.highlightState.headNode) return;

    const { nodes: connectedNodes, edges: connectedEdges } =
      this.getConnectedNodes(this.highlightState.headNode);

    // Filter out nodes/edges that are already in the trace path
    const connections = {
      nodes: new Set(),
      edges: new Set()
    };

    connectedNodes.forEach(nodeId => {
      if (!this.highlightState.tracePath.nodes.has(nodeId)) {
        connections.nodes.add(nodeId);
      }
    });

    connectedEdges.forEach(edgeKey => {
      if (!this.highlightState.tracePath.edges.has(edgeKey)) {
        connections.edges.add(edgeKey);
      }
    });

    const self = this;

    // Highlight connected nodes
    connections.nodes.forEach(nodeId => {
      const node = this.nodeLayer.select(`#node-${nodeId}`);
      if (!node.empty()) {
        node.each(function(d) {
          self.applyNodeStyle(d3.select(this), 'connected', d);
        });
        this.highlightState.activeHighlights.nodes.set(nodeId, { type: 'connected' });
      }
    });

    // Highlight connected edges
    connections.edges.forEach(edgeKey => {
      this.edgeLayer.selectAll('.edge').each(function() {
        const edge = d3.select(this);
        const source = edge.attr('data-source');
        const target = edge.attr('data-target');
        const currentKey = `${source}-${target}`;

        if (currentKey === edgeKey) {
          // Store original values if not already stored
          if (!edge.attr('data-original-stroke')) {
            edge.attr('data-original-stroke', edge.attr('stroke'))
                .attr('data-original-stroke-width', edge.attr('stroke-width'));
          }
          self.applyEdgeStyle(edge, 'connected');
          self.highlightState.activeHighlights.edges.set(edgeKey, { type: 'connected' });
        }
      });
    });
  }

  /**
   * Apply highlighting to the head node
   */
  applyHeadHighlight(nodeId) {
    const node = this.nodeLayer.select(`#node-${nodeId}`);
    if (!node.empty()) {
      const isInPath = this.highlightState.tracePath.nodes.has(nodeId);
      const self = this;
      node.each(function(d) {
        // Use 'path' style if node is in path, otherwise 'head'
        self.applyNodeStyle(d3.select(this), isInPath ? 'path' : 'head', d);
      });
      this.highlightState.activeHighlights.nodes.set(nodeId, { type: 'head' });
    }
  }

/**
   * Clear all manual selection highlighting (preserve filter highlights)
   */
  clearHighlight() {
    console.log("GraphRenderer: Clearing all manual selection highlights");

    // Clear node highlights using the clean system
    this.clearNodeHighlights();

    // Clear application group highlights
    this.clearApplicationHighlights();
  }

  /**
   * Public method to select a node by ID (for external calls)
   * @param {string} nodeId - ID of the node to select
   * @param {boolean} appendToSelection - Whether to add to existing selection
   */
  selectNodeById(nodeId, appendToSelection = false) {
    this.highlightNode(nodeId, appendToSelection);
  }

  /**
   * Highlight all application groups with the same name
   * @param {string} appName - Name of the application to highlight
   * @param {boolean} appendToSelection - Whether to add to existing selection
   */
  highlightApplicationGroups(appName, appendToSelection = false) {
    console.log("GraphRenderer: Highlighting application groups with name", appName);

    // Clear existing highlights if not appending
    if (!appendToSelection) {
      this.clearApplicationHighlights();
    }

    // Track highlighted application names
    if (!this.highlightedApplications) {
      this.highlightedApplications = new Set();
    }
    this.highlightedApplications.add(appName);

    // Find and highlight all application groups with the same name
    this.groupLayer.selectAll('circle.group')
      .filter(d => d.id.startsWith('app-') && d.data.name === appName)
      .each(function(d) {
        const group = d3.select(this);
        
        // Apply more dramatic orange halo with deeper colors
        group.style('filter', 'drop-shadow(0 0 12px #FF6600) drop-shadow(0 0 6px #FF9933)')
             .style('fill', '#FFD4A3')  // Softer orange fill (30% less intense than #FFB366)
             .style('fill-opacity', '0.8')  // Slightly more opaque
             .style('stroke-width', '4')  // Thicker stroke
             .style('stroke', '#FF6600')  // Keep the orange stroke
             .attr('r', d.r * 1.08)  // More noticeable enlargement
             .classed('app-highlighted', true);
      });
    
    // Also enhance the labels for highlighted application groups
    this.labelLayer.selectAll('g.group-label-container')
      .filter(d => d.id.startsWith('app-') && d.data.name === appName)
      .each(function(d) {
        const labelContainer = d3.select(this);
        
        // Make the label text bigger and bolder
        const textElement = labelContainer.select('text.group-label')
          .style('font-size', '16px')  // Bigger font (was 12px for app groups)
          .style('font-weight', '900')  // Extra bold
          .style('fill', '#333');  // Keep black text
          
        // Get new text dimensions after size change
        const bbox = textElement.node().getBBox();
        
        // Update the label background to fit the larger text
        labelContainer.select('rect')
          .attr('x', -bbox.width/2 - 6)  // Add more padding for larger text
          .attr('y', -bbox.height/2 - 3)
          .attr('width', bbox.width + 12)
          .attr('height', bbox.height + 6)
          .style('fill', 'rgba(255, 255, 255, 0.95)')  // Brighter background
          .style('stroke', '#999')  // Keep original gray border
          .style('stroke-width', '1.5');  // Slightly thicker but not too much
          
        // Mark as highlighted for proper restoration
        labelContainer.classed('app-label-highlighted', true);
      });
  }

  /**
   * Clear application group highlights
   */
  clearApplicationHighlights() {
    console.log("GraphRenderer: Clearing application group highlights");

    // Restore original label styling
    this.labelLayer.selectAll('g.group-label-container.app-label-highlighted')
      .each(function(d) {
        const labelContainer = d3.select(this);
        const labelText = d.label || d.id;
        
        // Restore label text to original size
        const textElement = labelContainer.select('text.group-label')
          .style('font-size', '12px')  // Back to default for app groups
          .style('font-weight', 'bold')  // Back to normal bold
          .style('fill', '#555');  // Back to default color
          
        // Recalculate box size for restored text
        const bbox = textElement.node().getBBox();
          
        // Restore label background with correct size
        labelContainer.select('rect')
          .attr('x', -bbox.width/2 - 4)  // Original padding
          .attr('y', -bbox.height/2 - 2)
          .attr('width', bbox.width + 8)
          .attr('height', bbox.height + 4)
          .style('fill', 'rgba(240, 240, 245, 0.85)')  // Original background
          .style('stroke', '#999')  // Original border
          .style('stroke-width', '1');  // Original width
          
        // Remove highlighted class
        labelContainer.classed('app-label-highlighted', false);
      });
    
    if (this.highlightedApplications) {
      this.highlightedApplications.clear();
    }

    // Remove highlights from all application groups
    this.groupLayer.selectAll('circle.group.app-highlighted')
      .each(function(d) {
        const group = d3.select(this);
        
        // Restore original styling
        group.style('filter', null)
             .style('fill', null)  // Reset fill color
             .style('fill-opacity', null)  // Reset opacity
             .style('stroke-width', null)
             .style('stroke', null)
             .attr('r', d.r) // Reset to original radius
             .classed('app-highlighted', false);
      });
  }

  /**
   * Unified click handler for groups
   * Determines group type and routes to appropriate handler
   */
  handleGroupClick(event, d) {
    event.stopPropagation(); // Prevent background click
    
    // Clear any existing highlights from other systems
    this.clearNodeHighlights();
    
    // Route based on group type
    if (d.id.startsWith('app-') && d.data.name) {
      this.handleApplicationGroupClick(event, d);
    } else {
      // For cluster/boundary groups, do nothing (no details panel)
      console.log('Non-application group clicked, ignoring:', d.id);
    }
  }

  /**
   * Handle clicks on application groups specifically
   */
  handleApplicationGroupClick(event, d) {
    const appName = d.data.name;
    console.log('Application group clicked:', appName);
    
    // Apply application-specific highlighting
    this.highlightApplicationGroups(appName, event.shiftKey);
    
    // Look up and emit application data
    if (this.data?.applicationDataMap?.has(appName)) {
      const applicationData = this.data.applicationDataMap.get(appName);
      this.emitClickEvent(applicationData, event, 'application');
    } else {
      console.warn('Application data not found for:', appName);
      this.emitClickEvent(d, event, 'group');
    }
  }

  /**
   * Unified click handler for nodes
   */
  handleNodeClick(event, d) {
    event.stopPropagation(); // Prevent background click
    
    // Clear any existing highlights from other systems
    this.clearApplicationHighlights();
    
    // Apply node-specific highlighting
    this.highlightNode(d.id, event.shiftKey);
    
    // Emit vertex data (includes both app and database properties)
    this.emitClickEvent(d, event, 'node');
  }

  /**
   * Unified event emission with type information
   */
  emitClickEvent(data, event, type) {
    if (this.options.onNodeClick) {
      // For vertex objects (nodes/groups), pass the data property (clean database properties)
      // For application data, pass as-is
      let cleanData;
      if (data && data.data && typeof data.data === 'object') {
        // This is a vertex object - pass the clean database properties only
        cleanData = data.data;
      } else {
        // This is already application data - pass as-is
        cleanData = data;
      }
      
      // Pass only clean data to UI - no internal application metadata
      this.options.onNodeClick(cleanData, event);
    }
  }

  /**
   * Clear only node highlights (not application highlights)
   */
  clearAllHighlights() {
    // Clear ALL node highlights - restore everything to default
    if (this.nodeLayer) {
      const self = this;
      this.nodeLayer.selectAll('.node').each(function(d) {
        const node = d3.select(this);

        // Clear original color storage
        node.attr('data-original-color', null);

        // Use unified styling - but ignore filter states (this is a complete clear)
        self.applyNodeStyle(node, 'normal', d);
      });
    }

    // Clear ALL edge highlights - restore everything to default
    if (this.edgeLayer) {
      const self = this;
      this.edgeLayer.selectAll('.edge').each(function() {
        const edge = d3.select(this);

        // Store original values if not already stored
        if (!edge.attr('data-original-stroke')) {
          edge.attr('data-original-stroke', edge.attr('stroke'))
              .attr('data-original-stroke-width', edge.attr('stroke-width'));
        }

        // Use unified styling
        self.applyEdgeStyle(edge, 'normal');

        // Clear stored values after reset
        edge.attr('data-original-stroke', null)
            .attr('data-original-stroke-width', null);
      });
    }
  }

  /**
   * Clean clear functionality - reset everything to normal
   */
  clearNodeHighlights() {
    // Clear state
    this.highlightState.headNode = null;
    this.highlightState.tracePath.nodes.clear();
    this.highlightState.tracePath.edges.clear();
    this.highlightState.activeHighlights.nodes.clear();
    this.highlightState.activeHighlights.edges.clear();

    // Clear legacy state
    this.selectedNodeIds.clear();
    this.highlightedElements.nodes.clear();
    this.highlightedElements.edgeKeys.clear();

    // Reset all visuals
    this.resetAllVisuals();
  }

  /**
   * Apply visual highlighting to a single node (reused by both manual and filter highlighting)
   * @param {string} nodeId - Node ID to highlight
   * @param {boolean} isDirectlySelected - Whether this node is directly selected (vs connected)
   */
  applyNodeHighlighting(nodeId, isDirectlySelected = true) {
    const nodeElement = this.nodeLayer.select(`#node-${nodeId}`);
    if (nodeElement.empty()) return;

    const self = this;
    nodeElement.each(function(d) {
      const node = d3.select(this);
      // Use head style for directly selected, connected style otherwise
      self.applyNodeStyle(node, isDirectlySelected ? 'head' : 'connected', d);
    });
  }

  /**
   * Remove visual highlighting from a single node
   * @param {string} nodeId - Node ID to unhighlight
   */
  unhighlightNode(nodeId) {
    const nodeElement = this.nodeLayer.select(`#node-${nodeId}`);
    if (nodeElement.empty()) return;

    const self = this;
    nodeElement.each(function(d) {
      const node = d3.select(this);
      self.applyNodeStyle(node, 'normal', d);
    });
  }

  /**
   * Set filter-based highlighting for nodes (reuses existing highlight styling)
   * @param {Set} filterHighlightedNodeIds - Set of node IDs to highlight via filters
   */
  setFilterHighlights(filterHighlightedNodeIds) {
    console.log("GraphRenderer: Setting filter highlights for", filterHighlightedNodeIds.size, "nodes");
    
    // Store current filter highlights and clear previous ones
    const previousFilterHighlights = new Set(this.filterHighlightedNodes || []);
    this.filterHighlightedNodes = new Set(filterHighlightedNodeIds);
    
    // Clear highlights that are no longer in the filter set (but preserve manual selections)
    previousFilterHighlights.forEach(nodeId => {
      if (!filterHighlightedNodeIds.has(nodeId) && !this.selectedNodeIds.has(nodeId)) {
        this.unhighlightNode(nodeId);
      }
    });

    // Apply highlighting to new filter matches (reuse existing highlight method)
    filterHighlightedNodeIds.forEach(nodeId => {
      if (!this.selectedNodeIds.has(nodeId)) {
        this.applyNodeHighlighting(nodeId, true); // Filter highlights get same treatment as directly selected
      }
    });
  }

  /**
   * Set filter-based dimming for nodes (new approach - dims non-matching nodes)
   * @param {Set} filteredOutNodeIds - Set of node IDs to dim (don't match filters)
   */
  setFilterDimming(filteredOutNodeIds) {
    console.log("GraphRenderer: Setting filter dimming for", filteredOutNodeIds.size, "nodes");

    // Clear previous dimming
    const previousFilteredOutNodes = new Set(this.filteredOutNodes || []);
    this.filteredOutNodes = new Set(filteredOutNodeIds);

    // Remove dimming from nodes that are no longer filtered out
    previousFilteredOutNodes.forEach(nodeId => {
      if (!filteredOutNodeIds.has(nodeId)) {
        this.removeNodeDimming(nodeId);
      }
    });

    // Apply dimming to newly filtered out nodes
    filteredOutNodeIds.forEach(nodeId => {
      this.applyNodeDimming(nodeId);
    });

    // Apply edge dimming based on filtered out nodes
    if (filteredOutNodeIds.size > 0) {
      this.applyEdgeDimming();
    } else {
      this.removeEdgeDimming();
    }

    // Handle zoom behavior based on filter state
    if (filteredOutNodeIds.size > 0) {
      // Auto-zoom to visible nodes first
      setTimeout(() => {
        InteractionUtils.zoomToVisibleNodes(this);

        // Then trigger pulse animation after zoom completes
        setTimeout(() => {
          InteractionUtils.bounceAllNodes(this);
        }, 850);
      }, 100);
    } else if (previousFilteredOutNodes.size > 0 && filteredOutNodeIds.size === 0) {
      // Filters were cleared - reset the zoom view
      setTimeout(() => {
        InteractionUtils.resetView(this);
      }, 100);
    }
  }

  /**
   * Apply dimming effect to a node
   * @param {string} nodeId - ID of the node to dim
   */
  applyNodeDimming(nodeId) {
    const self = this;
    // Find the node element
    this.nodeLayer.selectAll('.node')
      .filter(d => d.id === nodeId)
      .each(function(d) {
        const node = d3.select(this);
        node.classed('dimmed', true);
        self.applyNodeStyle(node, 'dimmed', d);
      });
  }

  /**
   * Remove dimming effect from a node
   * @param {string} nodeId - ID of the node to undim
   */
  removeNodeDimming(nodeId) {
    const self = this;
    // Find the node element
    this.nodeLayer.selectAll('.node')
      .filter(d => d.id === nodeId)
      .each(function(d) {
        const node = d3.select(this);
        node.classed('dimmed', false);
        self.applyNodeStyle(node, 'normal', d);
      });
  }

  /**
   * Apply dimming to edges connected to filtered-out nodes
   */
  applyEdgeDimming() {
    if (!this.edgeLayer || !this.data.edges) return;

    const filteredOutNodes = this.filteredOutNodes; // Capture in closure

    // Apply dimming based on edge endpoints
    this.edgeLayer.selectAll('line.edge')
      .each(function(d, i) {
        const edgeElement = d3.select(this);

        // Get source and target from the edge data attributes
        const source = edgeElement.attr('data-source');
        const target = edgeElement.attr('data-target');

        if (source && target) {
          // Check if either endpoint is filtered out
          const sourceFiltered = filteredOutNodes.has(source);
          const targetFiltered = filteredOutNodes.has(target);

          if (sourceFiltered || targetFiltered) {
            // Apply dimming: moderate opacity, longer dashed stroke
            edgeElement
              .style('opacity', 0.4)
              .style('stroke-dasharray', '6,6');
          } else {
            // Remove dimming if neither endpoint is filtered
            edgeElement
              .style('opacity', null)
              .style('stroke-dasharray', null);
          }
        }
      });
  }

  /**
   * Remove dimming from all edges
   */
  removeEdgeDimming() {
    if (!this.edgeLayer) return;

    this.edgeLayer.selectAll('line.edge')
      .style('opacity', null)
      .style('stroke-dasharray', null);
  }


  /**
   * Show tooltip on node hover
   */
  showTooltip(event, nodeData) {
    // Create tooltip if it doesn't exist
    if (!this.tooltip) {
      this.tooltip = d3.select('body')
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
    this.tooltip
      .html(content.replace(/\n/g, '<br>'))
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 10) + 'px')
      .style('opacity', 1);
  }

  /**
   * Hide tooltip
   */
  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style('opacity', 0);
    }
  }
  
  /**
   * Cleanup
   */
  destroy() {
    d3.select(this.container).selectAll('*').remove();
    this.nodePositions.clear();
    this.groupPositions.clear();
    
    // Clean up tooltip
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }

  // Public API methods that delegate to utility classes
  resetView() {
    InteractionUtils.resetView(this);
  }

  zoomIn() {
    InteractionUtils.zoomIn(this);
  }

  zoomOut() {
    InteractionUtils.zoomOut(this);
  }

  zoomToVisibleNodes() {
    InteractionUtils.zoomToVisibleNodes(this);
  }

  bounceAllNodes() {
    InteractionUtils.bounceAllNodes(this);
  }

  getZoom() {
    return InteractionUtils.getZoom(this);
  }
}