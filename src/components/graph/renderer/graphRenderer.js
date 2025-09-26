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
      // Canvas dimensions
      canvasDimensions: {
          width: this.options.width,
          height: this.options.height,
          centerX: this.options.width / 2,
          centerY: this.options.height / 2
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
        vertexMap: new Map(),
        edges: this.data?.edges
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
    this.context.state.edges = this.data?.edges;
    this.render();
  }

  
  /**
   * Main render method
   */
  render() {
    if (!this.data) return;

    // Build hierarchy from vertices (stores vertexMap in context.state)
    const { hierarchy, rootRadialElements } = LayoutUtils.buildHierarchy(this.context, this.data.vertices);
    if (!hierarchy) return;

    // Calculate positions using D3 pack
    const packedRoot = LayoutUtils.d3CirclePack(this.context, hierarchy);
    if (!packedRoot) return;

    // If we have elements to position radially, handle them specially
    const packedRootWithRadial = (rootRadialElements && rootRadialElements.length > 0) ?
      LayoutUtils.addRadialLayout(this.context, packedRoot, rootRadialElements) :
      packedRoot;

    // Extract D3 positioning back to our vertex structure
    LayoutUtils.extractPositionsFromD3(this.context, packedRootWithRadial || packedRoot);

    // Store original positions for drag reset functionality
    NodeUtils.storeOriginalPositions(this.context);

    // Render everything
    GroupUtils.renderGroups(this.context);
    NodeUtils.renderNodes(this.context);
    EdgeUtils.renderEdges(this.context);
    
    // Fit the drawing to viewport on initial render
    LayoutUtils.fitToView(this.context);
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
    console.log('Application group clicked:', d);
    
    // Apply application-specific highlighting
    HighlightingUtils.selectApplicationGroups(this.context, d.app_name || d.data?.app_name, event.shiftKey);
    
    // Emit clean data for NodeDetails - pass d.data consistently
    if (this.options.onNodeClick) {
      this.options.onNodeClick(d.data, event);
    }
  }

  /**
   * Unified click handler for nodes
   */
  handleNodeClick(event, d) {
    event.stopPropagation(); // Prevent background click
    
    // Use unified selection logic
    this.selectNodeById(d.id, event.shiftKey);
    
    // Emit node data for NodeDetails - pass the clean database properties
    if (this.options.onNodeClick) {
      this.options.onNodeClick(d.data, event);
    }
  }


  /**
   * Cleanup
   */
  destroy() {
    d3.select(this.container).selectAll('*').remove();
    
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

  // Internal method for visual selection (called from click handlers)
  selectNodeById(nodeId, appendToSelection = false) {
    // Clear any existing highlights from other systems
    HighlightingUtils.clearApplicationSelection(this.context);
    
    // Apply node-specific highlighting
    HighlightingUtils.highlightNode(this.context, nodeId, appendToSelection);
  }
}