import * as d3 from 'd3';

import { EdgeUtils } from './edgeUtils.js';
import { NodeUtils } from './nodeUtils.js';
import { LayoutUtils } from './layoutUtils.js';
import { FilteringFeature } from './filteringFeature.js';
import { HighlightingFeature } from './highlightingFeature.js';
import { GroupUtils } from './groupUtils.js';
import { FeatureRegistry } from './featureRegistry.js';
import { initializeOptions, getOptions } from './options.js';
import { applyCollapseTransform } from './collapseTransform.js';

/**
 * GraphRenderer - D3 hierarchical graph renderer with advanced edge styling
 * Renders vertices and edges with circle packing and complex edge interactions
 */
export class GraphRenderer {
  constructor(container, options = {}) {
    this.container = container;
    
    // Initialize global options for all utilities
    initializeOptions({
      width: options.width || 800,
      height: options.height || 600,
      nodePadding: options.nodePadding || 15,
      nodeRadius: options.nodeRadius || 25,
      groupPadding: options.groupPadding || 50,
      ...options
    });

    this.data = null;
    this.svg = null;
    this.g = null;
    this.zoom = null;

    // Initialize context as single source of truth
    this.context = {
      // Core mutable state
      state: {
        vertexMap: new Map(),
        edges: null,
        collapsedGroups: new Set()  // Track collapsed application groups
      },

      // DOM references (populated in init)
      dom: {
        svg: null,
        zoom: null,
        defs: null,
        layers: {
          nodeLayer: null,
          edgeLayer: null,
          groupLayer: null,
          labelLayer: null
        }
      }
    };

    this.init();
  }



  /**
   * Initialize SVG
   */
  init() {
    // Initialize feature registry with context
    FeatureRegistry.initialize(this.context);

    // Register features
    FeatureRegistry.register(FilteringFeature);
    FeatureRegistry.register(HighlightingFeature);

    // Clear container
    d3.select(this.container).selectAll('*').remove();
    
    // Create SVG
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('id', 'graph-svg')
      .attr('width', getOptions().width)
      .attr('height', getOptions().height)
      .style('background', '#f8f9fa')
      .on('click', (event) => {
        // Clear highlights when clicking background (unless shift key is pressed)
        if (!event.shiftKey) {
          HighlightingFeature.clearSelectedNodes();
          HighlightingFeature.clearSelectedApplications();
          FeatureRegistry.triggerRender();

          // Notify parent that nothing is selected (closes NodeDetails panel)
          if (getOptions().onNodeClick) {
            getOptions().onNodeClick(null, event);
          }
        }
      });
    
    // Add definitions for gradients and markers
    this.context.dom.defs = this.svg.append('defs');
    
    // Initialize edge markers through EdgeUtils
    EdgeUtils.initArrowMarkers(this.context.dom.defs);
    
    // Main group for zooming/panning
    this.g = this.svg.append('g');

    // Add zoom behavior
    this.zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .filter(event => {
        // Disable double-click zoom, allow all other interactions
        return event.type !== 'dblclick';
      })
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);

        // Emit zoom change event if callback is provided
        if (getOptions().onZoomChange) {
          getOptions().onZoomChange(event.transform.k);
        }
      });

    this.svg.call(this.zoom);

    // Set DOM references for utilities that need them
    this.context.dom.svg = this.svg;
    this.context.dom.zoom = this.zoom;
    
    // Create layers (order determines z-index: groups behind edges behind nodes behind labels)
    this.context.dom.layers.groupLayer = this.g.append('g').attr('class', 'groups');
    this.context.dom.layers.edgeLayer = this.g.append('g').attr('class', 'edges');
    this.context.dom.layers.nodeLayer = this.g.append('g').attr('class', 'nodes');
    this.context.dom.layers.labelLayer = this.g.append('g').attr('class', 'labels');
  }
  
  /**
   * Set data and render
   */
  setData(data) {
    this.data = data;
    this.context.state.edges = data?.edges;
    this.render();
  }

  
  /**
   * Main render method - builds layout and renders
   */
  render() {
    if (!this.data) return;

    // Clear all existing graph elements before re-rendering
    Object.values(this.context.dom.layers).forEach(layer => layer.selectAll('*').remove());

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

    // Render with current collapse state
    this.renderWithCollapse();

    // Fit the drawing to viewport on initial render
    LayoutUtils.fitToView(this.context);
  }

  /**
   * Re-render DOM elements with collapse transform applied
   * Does NOT recalculate layout - preserves positions
   */
  renderWithCollapse() {
    // Clear all existing graph elements
    Object.values(this.context.dom.layers).forEach(layer => layer.selectAll('*').remove());

    // Store raw data if not already stored
    if (!this.rawVertexMap) {
      this.rawVertexMap = this.context.state.vertexMap;
      this.rawEdges = this.context.state.edges;
    }

    const { vertexMap: transformedVertexMap, edges: transformedEdges } = applyCollapseTransform(
      this.rawVertexMap,
      this.rawEdges,
      this.context.state.collapsedGroups
    );

    // Replace state with transformed data (and keep it!)
    this.context.state.vertexMap = transformedVertexMap;
    this.context.state.edges = transformedEdges;

    // Render everything with transformed data
    GroupUtils.renderGroups(
      this.context,
      (event, d) => this.handleGroupClick(event, d),
      (event, d) => this.handleGroupDoubleClick(event, d)
    );
    NodeUtils.renderNodes(
      this.context,
      (event, d) => this.handleNodeClick(event, d),
      (event, d) => this.handleNodeDoubleClick(event, d)
    );
    EdgeUtils.renderEdges(this.context);

    // NOTE: We DON'T restore state anymore - context now has transformed data
    // This way drag handlers and other async operations use the correct transformed state
  }


  /**
   * Unified click handler for groups
   * Determines group type and routes to appropriate handler
   */
  handleGroupClick(event, d) {
    event.stopPropagation(); // Prevent background click

    // Route based on group type
    if (!d.id.startsWith('app-')) {
      // For cluster/boundary groups, do nothing (no details panel)
      return;
    }

    // Emit clean data for NodeDetails - pass d.data consistently
    if (getOptions().onNodeClick) {
      getOptions().onNodeClick(d.data, event);
    }
  }

  /**
   * Handle double-click on groups for collapse/expand toggle
   */
  handleGroupDoubleClick(event, d) {
    event.stopPropagation(); // Prevent background click

    // Only toggle application groups
    if (!d.id.startsWith('app-')) {
      return;
    }

    // Toggle collapse state
    if (this.context.state.collapsedGroups.has(d.id)) {
      this.context.state.collapsedGroups.delete(d.id);
    } else {
      this.context.state.collapsedGroups.add(d.id);
    }

    // Re-render WITHOUT re-layout (preserve positions)
    this.renderWithCollapse();
  }

  /**
   * Unified click handler for nodes
   */
  handleNodeClick(event, d) {
    event.stopPropagation(); // Prevent background click

    // Use unified selection logic
    this.selectNodeById(d.id, event.shiftKey);

    // Emit node data for NodeDetails - pass the clean database properties
    if (getOptions().onNodeClick) {
      getOptions().onNodeClick(d.data, event);
    }
  }

  /**
   * Handle double-click on nodes for expand (if collapsed Application node)
   */
  handleNodeDoubleClick(event, d) {
    event.stopPropagation(); // Prevent background click

    // Only expand if this is a collapsed Application node
    if (d.data?.type === 'Application' && this.context.state.collapsedGroups.has(d.id)) {
      this.context.state.collapsedGroups.delete(d.id);

      // Re-render WITHOUT re-layout (preserve positions)
      this.renderWithCollapse();
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

  // Public API methods for zoom controls
  resetView() {
    if (!this.context.dom.svg || !this.context.dom.zoom) return;

    // Reset zoom and pan
    this.context.dom.svg.transition().duration(500).call(
      this.context.dom.zoom.transform,
      d3.zoomIdentity
    );

    // Reset all node positions to original
    NodeUtils.resetNodePositions(this.context);

    // Fit to view using vertexMap
    LayoutUtils.fitToView(this.context);
  }

  zoomIn() {
    if (!this.context.dom.svg || !this.context.dom.zoom) return;
    this.context.dom.svg.transition().duration(300).call(
      this.context.dom.zoom.scaleBy, 1.5
    );
  }

  zoomOut() {
    if (!this.context.dom.svg || !this.context.dom.zoom) return;
    this.context.dom.svg.transition().duration(300).call(
      this.context.dom.zoom.scaleBy, 0.67
    );
  }

  /**
   * Collapse all application groups
   */
  collapseAll() {
    // Find all application groups in raw data
    if (!this.rawVertexMap) return;

    this.rawVertexMap.forEach((vertex, vertexId) => {
      if (vertex.isGroup && vertexId.startsWith('app-')) {
        this.context.state.collapsedGroups.add(vertexId);
      }
    });

    // Re-render with all apps collapsed
    this.renderWithCollapse();
  }

  /**
   * Expand all application groups
   */
  expandAll() {
    // Clear all collapsed groups
    this.context.state.collapsedGroups.clear();

    // Re-render with all apps expanded
    this.renderWithCollapse();
  }

  setFilterDimming(filteredOutNodeIds) {
    FilteringFeature.updateFilteredNodes(this.context, filteredOutNodeIds);

    const postRenderCallback =
      (filteredOutNodeIds.size > 0) ? () => FilteringFeature.zoomAndBounce(this.context) :
      LayoutUtils.fitToView(this.context);

    FeatureRegistry.triggerRender(postRenderCallback);
  }

  // Internal method for visual selection (called from click handlers)
  selectNodeById(nodeId, appendToSelection = false, skipStyling = false) {
    HighlightingFeature.clearSelectedApplications();
    HighlightingFeature.updateSelectedNodes(this.context, nodeId, appendToSelection);

    // Styling is applied by onDragEnd() handler - b/c d3 drag initiated click events.
    //  We skip styling here so we don't perform styling twice during drag handling.
    if (!skipStyling) {
      // Trigger re-render through registry
      FeatureRegistry.triggerRender();
    }
  }
}