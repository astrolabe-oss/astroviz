import * as d3 from 'd3';
import networkIcons from '../../networkIcons';
import { EdgeUtils } from './edgeUtils.js';
import { NodeUtils } from './nodeUtils.js';
import { LayoutUtils } from './layoutUtils.js';
import { InteractionUtils } from './interactionUtils.js';
import { FilteringUtils } from './filteringUtils.js';
import { HighlightingUtils } from './highlightingUtils.js';

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


    // Legacy state (to be phased out)
    this.selectedNodeIds = new Set();
    this.filteredOutNodes = new Set();

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
   * Create a highlighting context object with specific dependencies
   * @returns {Object} Context object for highlighting operations
   */
  createContext() {
    return {
      // Data access
      data: {
        edges: this.data?.edges,
        vertices: this.data?.vertices
      },

      // DOM layers
      layers: {
        nodeLayer: this.nodeLayer,
        edgeLayer: this.edgeLayer,
        groupLayer: this.groupLayer,
        labelLayer: this.labelLayer
      },

      // State
      state: {
        selectedNodeIds: this.selectedNodeIds,
        filteredOutNodes: this.filteredOutNodes,
        nodePositions: this.nodePositions,
        groupPositions: this.groupPositions,
        vertexMap: this.vertexMap,
        hierarchyRoot: this.hierarchyRoot,
        hybridLayout: this.hybridLayout
      },

      // Interaction state
      interaction: {
        edgeUpdateController: this.edgeUpdateController,
        svg: this.svg,
        zoom: this.zoom
      },

      // SVG definitions
      defs: this.defs,

      // Style methods
      styling: {
        applyNodeStyle: this.applyNodeStyle.bind(this),
        applyEdgeStyle: this.applyEdgeStyle.bind(this)
      },

      // UI handlers
      ui: {
        handleNodeClick: this.handleNodeClick.bind(this),
        showTooltip: this.showTooltip.bind(this),
        hideTooltip: this.hideTooltip.bind(this)
      },

      // Options
      options: this.options
    };
  }

  /**
   * Unified node styling function - Orchestrates highlight and filter styling
   * @param {d3.Selection} nodeSelection - D3 selection of node(s) to style
   * @param {string} state - 'normal'|'path'|'head'|'connected'|'dimmed'
   * @param {Object} nodeData - Node data for type-specific styling
   */
  applyNodeStyle(nodeSelection, state, nodeData = null) {
    // Apply highlighting styles
    HighlightingUtils.applyHighlightStyleToNode(
      nodeSelection, 
      state, 
      nodeData, 
      this.styling
    );
    
    // Apply filtering styles
    const nodeId = nodeData?.id || nodeSelection.attr('id')?.replace('node-', '');
    FilteringUtils.applyFilterStyleToNode(
      nodeSelection,
      nodeId,
      this.filteredOutNodes
    );
  }


  /**
   * Unified edge styling function - Orchestrates highlight and filter styling
   * @param {d3.Selection} edgeSelection - D3 selection of edge(s) to style
   * @param {string} state - 'normal'|'path'|'connected'|'dimmed'|'connected-inbound'
   */
  applyEdgeStyle(edgeSelection, state) {
    // Apply highlighting styles
    HighlightingUtils.applyHighlightStyleToEdge(
      edgeSelection, 
      state, 
      this.styling
    );
    
    // Apply filtering styles
    FilteringUtils.applyFilterStyleToEdge(
      edgeSelection,
      this.filteredOutNodes
    );
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
          HighlightingUtils.clearHighlight(this.context);
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

    // Create highlighting context after DOM layers are set up
    this.context = this.createContext();
  }
  
  /**
   * Set data and render
   */
  setData(data) {
    this.data = data;
    // Update context with new data
    this.updateContextData();
    this.render();
  }

  /**
   * Update the context with current data (called when data changes)
   */
  updateContextData() {
    if (this.context) {
      this.context.data.edges = this.data?.edges;
      this.context.data.vertices = this.data?.vertices;
    }
  }

  /**
   * Update the context with current state (called after hierarchy creation)
   */
  updateContextState() {
    if (this.context) {
      this.context.state.vertexMap = this.vertexMap;
      this.context.state.hierarchyRoot = this.hierarchyRoot;
      this.context.state.hybridLayout = this.hybridLayout;
    }
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

    // Update context with newly created state (after hierarchyRoot is set)
    this.updateContextState();

    // Store node positions for drag updates
    NodeUtils.storeNodePositions(this, packedRoot);

    // Render everything
    this.renderGroups(packedRoot);
    NodeUtils.renderNodes(this.context, packedRoot);
    EdgeUtils.renderEdges(this.context, packedRoot);
    
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
      .on('start', (event, d) => InteractionUtils.onGroupDragStart(this.context, event, d))
      .on('drag', (event, d) => InteractionUtils.onGroupDrag(this.context, event, d))
      .on('end', (event, d) => InteractionUtils.onGroupDragEnd(this.context, event, d));
    
    groupElements.call(groupDragBehavior);
  }
  

  /**
   * Unified click handler for groups
   * Determines group type and routes to appropriate handler
   */
  handleGroupClick(event, d) {
    event.stopPropagation(); // Prevent background click

    // Clear any existing highlights from other systems
    HighlightingUtils.clearNodeHighlights(this.context);

    // Route based on group type
    if (d.id.startsWith('app-') && d.data.label) {
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
    // Extract application name from label: 'App: app-precise-framework (4 nodes)' -> 'app-precise-framework'
    const label = d.data.label || '';
    const match = label.match(/App: (.+?) \(/);
    const appName = match ? match[1] : null;

    console.log('Application group clicked:', {
      label: label,
      extractedAppName: appName
    });
    
    // Apply application-specific highlighting
    HighlightingUtils.selectApplicationGroups(this.context, appName, event.shiftKey);
    
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
    HighlightingUtils.clearApplicationSelection(this.context);
    
    // Apply node-specific highlighting
    HighlightingUtils.highlightNode(this.context, d.id, event.shiftKey);
    
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
    InteractionUtils.resetView(this.context, this);
  }

  zoomIn() {
    InteractionUtils.zoomIn(this.context);
  }

  zoomOut() {
    InteractionUtils.zoomOut(this.context);
  }

  setFilterDimming(filteredOutNodeIds) {
    FilteringUtils.setFilterDimming(this, filteredOutNodeIds);
  }
  selectNodeById(nodeId, appendToSelection = false) {
    HighlightingUtils.highlightNode(this.context, nodeId, appendToSelection);
  }
}