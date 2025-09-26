import * as d3 from 'd3';
import networkIcons from '../../networkIcons';
import { EdgeUtils } from './edgeUtils.js';
import { NodeUtils } from './nodeUtils.js';
import { LayoutUtils } from './layoutUtils.js';
import { InteractionUtils } from './interactionUtils.js';
import { FilteringUtils } from './filteringUtils.js';
import { HighlightingUtils } from './highlightingUtils.js';
import { GroupUtils } from './groupUtils.js';

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

      // Style configuration
      styling: this.styling,

      // UI handlers
      ui: {
        handleNodeClick: this.handleNodeClick.bind(this),
        handleGroupClick: this.handleGroupClick.bind(this)
      },

      // Options
      options: this.options
    };
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
    
    // Initialize edge markers through EdgeUtils
    EdgeUtils.initArrowMarkers(this.defs);
    
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
    GroupUtils.renderGroups(this.context, packedRoot);
    NodeUtils.renderNodes(this.context, packedRoot);
    EdgeUtils.renderEdges(this.context, packedRoot);
    
    // Fit the drawing to viewport on initial render
    LayoutUtils.fitToView(this.context, packedRoot);
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
    
    // Note: We don't emit click events for application groups since they are purely
    // visual highlighting within the graph and should not trigger App.vue's node selection logic
  }

  /**
   * Unified click handler for nodes
   */
  handleNodeClick(event, d) {
    event.stopPropagation(); // Prevent background click
    
    // Use unified selection logic
    this.selectNodeById(d.id, event.shiftKey);
    
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
   * Cleanup
   */
  destroy() {
    d3.select(this.container).selectAll('*').remove();
    this.nodePositions.clear();
    this.groupPositions.clear();
    
    // Clean up tooltip through NodeUtils
    if (NodeUtils.tooltip) {
      NodeUtils.tooltip.remove();
      NodeUtils.tooltip = null;
    }
  }

  // Public API methods that delegate to utility classes
  resetView() {
    InteractionUtils.resetView(this.context);
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
    // Clear any existing highlights from other systems
    HighlightingUtils.clearApplicationSelection(this.context);
    
    // Apply node-specific highlighting
    HighlightingUtils.highlightNode(this.context, nodeId, appendToSelection);
  }
}