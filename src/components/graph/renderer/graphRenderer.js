import * as d3 from 'd3';
import networkIcons from '../../networkIcons';
import { EdgeUtils } from './edgeUtils.js';

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
    const hierarchy = this.buildHierarchy();
    if (!hierarchy) return;
    
    // Calculate positions using D3 pack
    const packedRoot = this.calculatePack(hierarchy);
    if (!packedRoot) return;
    
    // Extract D3 positioning back to our vertex structure
    this.extractPositionsFromD3(packedRoot);
    
    // Store the packed root for later use (e.g., drag end re-rendering)
    this.hierarchyRoot = packedRoot;
    
    // Store node positions for drag updates
    this.storeNodePositions(packedRoot);
    
    // Render everything
    this.renderGroups(packedRoot);
    this.renderNodes(packedRoot);
    this.renderEdges(packedRoot);
    
    // Fit the drawing to viewport on initial render
    this.fitToView(packedRoot);
  }
  
  /**
   * Store node positions from pack layout
   */
  storeNodePositions(packedRoot) {
    this.nodePositions.clear();
    this.groupPositions.clear();
    
    // Store positions using our clean vertex structure
    this.vertexMap.forEach((vertex, id) => {
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
          this.groupPositions.set(vertex.id, position);
        } else {
          this.nodePositions.set(vertex.id, position);
        }
      }
    });
  }

  
  /**
   * Build hierarchy from vertices data
   */
  buildHierarchy() {
    const vertices = this.data.vertices;
    if (!vertices) return null;
    
    console.log('Raw vertices data:', vertices);
    
    // Create vertex map with clean separation between app and database properties
    this.vertexMap = new Map();
    
    Object.entries(vertices).forEach(([id, vertex]) => {
      // Use the already properly structured data from graphTransformUtils
      this.vertexMap.set(id, {
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
      if (vertex.parentId && this.vertexMap.has(vertex.parentId)) {
        const parent = this.vertexMap.get(vertex.parentId);
        const child = this.vertexMap.get(id);
        parent.children.push(child);
      }
    });
    
    // Find roots (nodes with no parentId)
    const roots = [];
    this.vertexMap.forEach(vertex => {
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
    this.hybridLayout = {
      internetBoundaryGroup,
      rootLeafNodes,
      otherRootGroups
    };
    
    // For circle packing, exclude root leaf nodes - they'll be positioned radially
    const packedRoots = this.hybridLayout && this.hybridLayout.rootLeafNodes.length > 0 
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
  extractPositionsFromD3(packedRoot) {
    packedRoot.descendants().forEach(d => {
      const vertex = this.vertexMap.get(d.data.id);
      if (vertex) {
        vertex.x = d.x + 25;  // Apply offset for margin
        vertex.y = d.y + 25;
        vertex.r = d.r;
      }
    });
  }
  
  /**
   * Calculate optimal canvas size based on graph complexity
   */
  calculateOptimalCanvasSize(hierarchyRoot) {
    // Count nodes at each level
    let leafNodes = 0;
    let groupNodes = 0;
    let maxDepth = 0;
    let maxChildrenAtAnyLevel = 0;
    
    // Traverse hierarchy to gather statistics
    const traverse = (node, depth = 0) => {
      maxDepth = Math.max(maxDepth, depth);
      
      if (!node.children || node.children.length === 0) {
        leafNodes++;
      } else {
        groupNodes++;
        maxChildrenAtAnyLevel = Math.max(maxChildrenAtAnyLevel, node.children.length);
        node.children.forEach(child => traverse(child, depth + 1));
      }
    };
    
    traverse(hierarchyRoot);
    
    console.log(`Graph stats: ${leafNodes} leaves, ${groupNodes} groups, depth ${maxDepth}, max children ${maxChildrenAtAnyLevel}`);
    
    // Calculate scale factors based on complexity (very conservative)
    // More leaves need more space
    const leafFactor = Math.log10(leafNodes + 1) * 0.1;  // Use log for gentler scaling
    
    // Deeper hierarchies need more space for nested circles
    const depthFactor = maxDepth * 0.05;  // Very small increment per level
    
    // More groups need more space for labels and padding
    const groupFactor = Math.log10(groupNodes + 1) * 0.1;  // Use log for gentler scaling
    
    // Padding contributes to scale
    const paddingFactor = this.options.nodePadding / 200;  // Much smaller contribution
    
    // Calculate final scale (minimum 1x, typically 1.1-1.5x for complex graphs)
    const scale = Math.max(1, 1 + leafFactor + depthFactor + groupFactor + paddingFactor);
    
    const canvasWidth = this.options.width * scale;
    const canvasHeight = this.options.height * scale;
    
    console.log(`Canvas scaling: leaf(${leafFactor.toFixed(2)}) + depth(${depthFactor.toFixed(2)}) + group(${groupFactor.toFixed(2)}) + padding(${paddingFactor.toFixed(2)}) = ${scale.toFixed(2)}x`);
    console.log(`Final canvas: ${canvasWidth.toFixed(0)}x${canvasHeight.toFixed(0)}`);
    
    return { width: canvasWidth, height: canvasHeight, scale };
  }

  /**
   * Calculate circle packing layout with optional radial positioning for root leaf nodes
   */
  calculatePack(hierarchyRoot) {
    // Calculate optimal canvas size based on graph complexity
    const { width, height } = this.calculateOptimalCanvasSize(hierarchyRoot);
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Always do circle packing for the main hierarchy
    const root = d3.hierarchy(hierarchyRoot)
      .sum(d => {
        // Groups need a value for hierarchy, leaf nodes will use explicit radius
        return d.children && d.children.length > 0 ? 0 : 1;
      });

    const pack = d3.pack()
      .size([width - 50, height - 50])
      .padding(d => {
        // D3 padding function is called for PARENT nodes to set spacing between their CHILDREN
        // Check what type of children this parent has
        if (d.children && d.children.length > 0) {
          // Check if children are leaf nodes or groups
          const firstChild = d.children[0];
          const childrenAreLeafNodes = !firstChild.children || firstChild.children.length === 0;

          if (childrenAreLeafNodes) {
            // This parent's children are leaf nodes - use nodePadding
            return this.options.nodePadding;
          } else {
            // This parent's children are groups - use groupPadding
            return this.options.groupPadding;
          }
        }

        // Fallback (shouldn't happen since padding is only called for parents)
        return this.options.nodePadding;
      })
      .radius(d => {
        // Set explicit radius for leaf nodes based on nodeRadius setting
        if (!d.children || d.children.length === 0) {
          return this.options.nodeRadius;
        }
        // Let D3 calculate radius for group nodes (parents)
        return null;
      });
    
    const packedRoot = pack(root);
    
    // If we have root leaf nodes to position radially, handle them specially
    if (this.hybridLayout && this.hybridLayout.rootLeafNodes.length > 0) {
      return this.addRadialLayout(packedRoot, centerX, centerY);
    }
    
    return packedRoot;
  }
  
  /**
   * Add radial positioning for root leaf nodes around the packed layout
   */
  addRadialLayout(packedRoot, centerX, centerY) {
    const { rootLeafNodes, otherRootGroups } = this.hybridLayout;
    
    console.log(`Adding radial layout: ${rootLeafNodes.length} root leaves, ${otherRootGroups.length} other groups`);
    
    // Find the internet-boundary node in the packed hierarchy
    const internetBoundaryNode = packedRoot.descendants().find(d => d.data.id === 'internet-boundary');
    let internetBoundaryRadius = 0;
    
    if (internetBoundaryNode) {
      internetBoundaryRadius = internetBoundaryNode.r;
      
      // Center the internet boundary on the canvas
      const offsetX = centerX - internetBoundaryNode.x;
      const offsetY = centerY - internetBoundaryNode.y;
      
      // Apply offset to all nodes in the packed hierarchy
      packedRoot.descendants().forEach(node => {
        node.x += offsetX;
        node.y += offsetY;
      });
    }
    
    // Position root leaf nodes in a ring around the private network
    const ringRadius = internetBoundaryRadius + 80; // 80px gap from internet boundary edge
    const radialNodes = [];
    
    if (rootLeafNodes.length > 0) {
      const angleStep = (2 * Math.PI) / rootLeafNodes.length;
      
      rootLeafNodes.forEach((leafNode, index) => {
        const angle = index * angleStep;
        const x = centerX + Math.cos(angle) * ringRadius;
        const y = centerY + Math.sin(angle) * ringRadius;
        
        // Create a packed node structure for consistency
        const radialNode = {
          data: leafNode,
          x: x,
          y: y,
          r: this.options.nodeRadius, // Use consistent radius (no fallback)
          children: null,
          parent: packedRoot,
          depth: 1,
          height: 0
        };
        
        radialNodes.push(radialNode);
      });
    }
    
    // Handle other root groups (if any) - position them further out
    if (otherRootGroups.length > 0) {
      const outerRingRadius = ringRadius + 100;
      const outerAngleStep = (2 * Math.PI) / otherRootGroups.length;
      
      otherRootGroups.forEach((group, index) => {
        const angle = index * outerAngleStep;
        const x = centerX + Math.cos(angle) * outerRingRadius;
        const y = centerY + Math.sin(angle) * outerRingRadius;
        
        const radialGroup = {
          data: group,
          x: x,
          y: y,
          r: 50, // Default group radius
          children: null,
          parent: packedRoot,
          depth: 1,
          height: 0
        };
        
        radialNodes.push(radialGroup);
      });
    }
    
    // Add radial nodes to the packed hierarchy's descendants method
    const originalDescendants = packedRoot.descendants.bind(packedRoot);
    packedRoot.descendants = () => [...originalDescendants(), ...radialNodes];
    
    console.log(`Radial layout complete: added ${radialNodes.length} radial nodes to packed hierarchy`);
    
    return packedRoot;
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
      .on('start', (event, d) => this.onGroupDragStart(event, d))
      .on('drag', (event, d) => this.onGroupDrag(event, d))
      .on('end', (event, d) => this.onGroupDragEnd(event, d));
    
    groupElements.call(groupDragBehavior);
  }
  
  /**
   * Render node icons
   */
  renderNodes(packedRoot) {
    console.log('=== renderNodes called ===');
    const nodes = Array.from(this.vertexMap.values())
      .filter(vertex => !vertex.isGroup && !vertex.isVirtual);
    console.log('Found nodes:', nodes.length);
    
    // Create node elements to hold icons
    const nodeElements = this.nodeLayer
      .selectAll('g.node')
      .data(nodes, vertex => vertex.id)
      .join('g')
      .attr('class', 'node')
      .attr('id', vertex => `node-${vertex.id}`)
      .attr('transform', vertex => `translate(${vertex.x}, ${vertex.y})`)
      .style('cursor', 'grab')
      .on('click', (event, vertex) => {
        this.handleNodeClick(event, vertex);
      })
      .on('mouseover', (event, vertex) => {
        // Show tooltip on hover
        this.showTooltip(event, vertex.data);
      })
      .on('mouseout', () => {
        // Hide tooltip
        this.hideTooltip();
      });

    // Add icons to node elements (like the old GraphVisualization.vue)
    const self = this;
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
        const pos = this.nodePositions.get(d.id);
        return pos ? { x: pos.x, y: pos.y } : { x: d.x + 25, y: d.y + 25 };
      })
      .filter(event => !event.ctrlKey) // Allow ctrl+click to bypass drag for accessibility
      .clickDistance(5) // Require 5 pixels of movement before starting drag
      .on('start', (event, d) => this.onDragStart(event, d))
      .on('drag', (event, d) => this.onDrag(event, d))
      .on('end', (event, d) => this.onDragEnd(event, d));
    
    console.log('Attaching drag behavior to', nodeElements.size(), 'node elements');
    nodeElements.call(dragBehavior);
    console.log('Drag behavior attached');
  }
  

  /**
   * Create or update gradient for an edge
   */
  createEdgeGradient(edgeId, stops, x1, y1, x2, y2) {
    const gradientId = `edge-gradient-${edgeId}`;
    
    // Remove existing gradient
    this.defs.select(`#${gradientId}`).remove();
    
    // Create new gradient aligned with the line
    const gradient = this.defs.append('linearGradient')
      .attr('id', gradientId)
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', x1)
      .attr('y1', y1)
      .attr('x2', x2)
      .attr('y2', y2);
    
    // Add stops
    stops.forEach(stop => {
      gradient.append('stop')
        .attr('offset', stop.offset)
        .attr('stop-color', stop.color)
        .attr('stop-opacity', stop.opacity);
    });
    
    return `url(#${gradientId})`;
  }

  /**
   * Render edges
   */
renderEdges(packedRoot) {
    if (!this.data.edges) return;
    
    // Extract rendering data using utility method
    const { positionMap, applicationGroups, clusterGroups, nodeToAppMap, nodeToClusterMap } = 
      EdgeUtils.extractRenderingData(packedRoot);
    
    // Filter edges to only those with both endpoints visible
    const visibleEdges = this.data.edges.filter(edge => {
      return positionMap.has(edge.source) && positionMap.has(edge.target);
    });
    
    // Clear existing edges
    this.edgeLayer.selectAll('line.edge').remove();
    
    // Create single gradient edges using segment data
    visibleEdges.forEach((edge, edgeIndex) => {
      // Get source and target positions
      const sourcePos = positionMap.get(edge.source);
      const targetPos = positionMap.get(edge.target);
      
      // Calculate adjusted endpoint using utility method
      const shortenBy = this.options.nodeRadius * 0.7;
      const { x2: adjustedTargetX, y2: adjustedTargetY } = EdgeUtils.shortenEdgeForArrow(sourcePos, targetPos, shortenBy);
      
      // Check if this edge is highlighted
      const edgeKey = `${edge.source}-${edge.target}`;
      const isHighlighted = this.highlightedElements.edgeKeys.has(edgeKey);
      
      let strokeStyle, strokeWidth;
      
      if (isHighlighted) {
        // Use solid purple for highlighted edges
        strokeStyle = '#4444ff';
        strokeWidth = 3;
      } else {
        // Use gradient segments for non-highlighted edges
        // Find home groups using utility method
        const { homeApps, homeClusters } = EdgeUtils.findHomeGroups(edge, nodeToAppMap, nodeToClusterMap);
        
        // Create adjusted position map for segment calculation
        const adjustedPositionMap = new Map(positionMap);
        adjustedPositionMap.set(edge.target, { x: adjustedTargetX, y: adjustedTargetY });
        
        // Create filter function using utility method
        const isUnrelatedGroupFilter = EdgeUtils.createUnrelatedGroupFilter(
          homeApps, homeClusters, applicationGroups, clusterGroups
        );
        
        const segments = EdgeUtils.calculateEdgeSegments(
          edge, 
          adjustedPositionMap,
          [...applicationGroups, ...clusterGroups],
          isUnrelatedGroupFilter
        );
        
        // Convert segments to gradient stops
        const gradientStops = EdgeUtils.segmentsToGradientStops(segments);
        
        // Create unique edge ID
        const edgeId = `${edge.source}-${edge.target}-${edgeIndex}`;
        
        // Create gradient for this edge (use adjusted coordinates)
        strokeStyle = this.createEdgeGradient(
          edgeId, 
          gradientStops, 
          sourcePos.x, 
          sourcePos.y, 
          adjustedTargetX, 
          adjustedTargetY
        );
        strokeWidth = 1.5;
      }
      
      // Check if this edge should be dimmed (connected to filtered nodes)
      const sourceFiltered = this.filteredOutNodes && this.filteredOutNodes.has(edge.source);
      const targetFiltered = this.filteredOutNodes && this.filteredOutNodes.has(edge.target);
      const shouldBeDimmed = sourceFiltered || targetFiltered;

      // Create single line with appropriate styling including filtering state
      const edgeElement = this.edgeLayer
        .append('line')
        .attr('class', 'edge')
        .attr('data-source', edge.source)
        .attr('data-target', edge.target)
        .attr('data-edge-id', `${edge.source}-${edge.target}-${edgeIndex}`)
        .attr('x1', sourcePos.x)
        .attr('y1', sourcePos.y)
        .attr('x2', adjustedTargetX)
        .attr('y2', adjustedTargetY)
        .attr('stroke', strokeStyle)
        .attr('stroke-width', strokeWidth)
        .attr('marker-end', 'url(#arrow)');

      // Apply dimming styles if needed (at creation time, no flashing)
      if (shouldBeDimmed) {
        edgeElement
          .style('opacity', 0.4)
          .style('stroke-dasharray', '6,6');
      }
    });
  }
  
  /**
   * Unified cursor management for drag operations
   */
  setCursor(event, cursor) {
    d3.select(event.sourceEvent.target).style('cursor', cursor);
  }

  /**
   * Drag handlers
   */
  onDragStart(event, d) {
    console.log('=== onDragStart called ===', d.id);
    this.setCursor(event, 'grabbing');
  }
  
  onDrag(event, d) {
    const nodeId = d.id;
    const nodePos = this.nodePositions.get(nodeId);
    if (!nodePos) return;
    
    // Update the subject position and use it for consistent coordinates
    event.subject.x = event.x;
    event.subject.y = event.y;
    
    // Update position tracking
    nodePos.x = event.x;
    nodePos.y = event.y;
    
    // Move the node group visually
    d3.select(`#node-${nodeId}`)
      .attr('transform', `translate(${event.x}, ${event.y})`);
    
    // Update all non-highlighted edges
    this.updateAllEdgesAsync();
  }
  
  onDragEnd(event, d) {
    console.log('=== onDragEnd called ===');
    this.setCursor(event, 'grab');
    
    // Use unified pipeline like group drag end
    this.updateAllEdgesAsync();
  }
  
  /**
   * Group drag handlers
   */
  onGroupDragStart(event, d) {
    console.log('=== onGroupDragStart called ===', d.id);
    
    // Prevent dragging the private network
    if (d.id === 'private-network') {
      event.sourceEvent.preventDefault();
      return;
    }
    
    this.setCursor(event, 'grabbing');
  }
  
  onGroupDrag(event, d) {
    const groupId = d.id;
    
    // Prevent dragging the private network
    if (groupId === 'private-network') {
      return;
    }
    
    const groupPos = this.groupPositions.get(groupId);
    if (!groupPos) return;
    
    // Calculate movement delta
    const deltaX = event.x - groupPos.x;
    const deltaY = event.y - groupPos.y;
    
    // Update the group position and move all children
    this.moveGroupAndChildren(groupId, deltaX, deltaY);
    this.updateAllEdgesAsync();
  }
  
  onGroupDragEnd(event, d) {
    console.log('=== onGroupDragEnd called ===', d.id);
    this.setCursor(event, 'grab');
    
    // Cancel any in-progress async update and do a final synchronous update
    if (this.edgeUpdateController) {
      this.edgeUpdateController.cancelled = true;
      this.edgeUpdateController = null;
    }
    
    
    // Do a final edge update to ensure everything is accurate
    this.updateAllEdgesAsync();
  }
  
  /**
   * Move a group and all its children by the given offset
   */
  moveGroupAndChildren(groupId, deltaX, deltaY) {
    const groupPos = this.groupPositions.get(groupId);
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
      const childNodePos = this.nodePositions.get(childId);
      const childGroupPos = this.groupPositions.get(childId);
      
      if (childNodePos) {
        // Move child node
        childNodePos.x += deltaX;
        childNodePos.y += deltaY;
        
        // Update visual position
        d3.select(`#node-${childId}`)
          .attr('transform', `translate(${childNodePos.x}, ${childNodePos.y})`);
        
        
      } else if (childGroupPos) {
        // Recursively move child group
        this.moveGroupAndChildren(childId, deltaX, deltaY);
      }
    });
  }
  


  /**
   * Update all edges asynchronously with cancellation support
   * Used when groups move to avoid blocking the UI
   */
  async updateAllEdgesAsync() {
    // Cancel any in-progress update
    if (this.edgeUpdateController) {
      this.edgeUpdateController.cancelled = true;
    }
    
    // Create new controller for this update
    const controller = { cancelled: false };
    this.edgeUpdateController = controller;
    
    // Yield to browser to keep UI responsive
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Check if cancelled
    if (controller.cancelled) return;
    
    // Now do the actual update - call self to handle the async work
    await this.doAllEdgesUpdate();
    
    // Clear controller if this update completed
    if (this.edgeUpdateController === controller) {
      this.edgeUpdateController = null;
    }
  }
  
  /**
   * Internal method to do the actual edge updates (extracted from sync method)
   */
  doAllEdgesUpdate() {
    if (!this.data.edges || !this.hierarchyRoot) return;

    console.log(`EdgeUpdate: Re-rendering all edges with current positions`);

    // Sync current drag positions back to hierarchyRoot before rendering
    this.syncCurrentPositionsToHierarchy();

    // Now call renderEdges with updated hierarchy - this handles all edge logic consistently
    this.renderEdges(this.hierarchyRoot);

    // Reapply highlighting if we have active selections
    if (this.highlightState.headNode) {
      console.log("DEBUG: Reapplying clean highlighting after edge update");
      this.applyCleanHighlighting();
    }
  }

  /**
   * Sync current drag positions from nodePositions/groupPositions maps back to hierarchyRoot
   */
  syncCurrentPositionsToHierarchy() {
    if (!this.hierarchyRoot) return;
    
    this.hierarchyRoot.descendants().forEach(node => {
      if (node.data.isGroup && !node.data.isVirtual) {
        const groupPos = this.groupPositions.get(node.data.id);
        if (groupPos) {
          node.x = groupPos.x - 25; // Remove offset used in rendering
          node.y = groupPos.y - 25;
          node.r = groupPos.r;
        }
      } else if (!node.data.isGroup && !node.data.isVirtual) {
        const nodePos = this.nodePositions.get(node.data.id);
        if (nodePos) {
          node.x = nodePos.x - 25; // Remove offset used in rendering
          node.y = nodePos.y - 25;
        }
      }
    });
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
        this.zoomToVisibleNodes();

        // Then trigger pulse animation after zoom completes
        setTimeout(() => {
          this.bounceAllNodes();
        }, 850);
      }, 100);
    } else if (previousFilteredOutNodes.size > 0 && filteredOutNodeIds.size === 0) {
      // Filters were cleared - reset the zoom view
      setTimeout(() => {
        this.resetView();
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
   * Zoom controls
   */
  zoomIn() {
    if (!this.svg || !this.zoom) return;
    this.svg.transition().duration(300).call(
      this.zoom.scaleBy, 1.5
    );
  }
  
  zoomOut() {
    if (!this.svg || !this.zoom) return;
    this.svg.transition().duration(300).call(
      this.zoom.scaleBy, 0.67
    );
  }
  
  resetView() {
    if (!this.svg || !this.zoom) return;

    // Reset zoom and pan
    this.svg.transition().duration(500).call(
      this.zoom.transform,
      d3.zoomIdentity
    );

    // Reset all node positions to original
    this.resetNodePositions();
    this.fitToView(this.hierarchyRoot);
  }

  /**
   * Zoom to bounds of visible (non-dimmed) nodes
   */
  zoomToVisibleNodes() {
    if (!this.svg || !this.zoom || !this.nodeLayer) return;

    // Get bounds of all non-dimmed nodes
    const visibleNodes = [];
    this.nodeLayer.selectAll('.node')
      .filter(d => !this.filteredOutNodes.has(d.id))
      .each(function(d) {
        const node = d3.select(this);
        const transform = node.attr('transform');
        if (transform) {
          const translate = transform.match(/translate\(([^)]+)\)/);
          if (translate) {
            const coords = translate[1].split(',');
            const x = parseFloat(coords[0]);
            const y = parseFloat(coords[1]);
            visibleNodes.push({ x, y, r: d.r || 15 });
          }
        }
      });

    if (visibleNodes.length === 0) {
      console.log('No visible nodes to zoom to');
      return;
    }

    // Calculate bounds with padding
    const padding = 50;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    visibleNodes.forEach(node => {
      minX = Math.min(minX, node.x - node.r);
      maxX = Math.max(maxX, node.x + node.r);
      minY = Math.min(minY, node.y - node.r);
      maxY = Math.max(maxY, node.y + node.r);
    });

    const boundsWidth = maxX - minX + 2 * padding;
    const boundsHeight = maxY - minY + 2 * padding;
    const boundsX = minX - padding;
    const boundsY = minY - padding;

    // Get current SVG dimensions
    const svgNode = this.svg.node();
    const svgWidth = svgNode.clientWidth || svgNode.getBoundingClientRect().width;
    const svgHeight = svgNode.clientHeight || svgNode.getBoundingClientRect().height;

    // Calculate scale to fit bounds in view with maximum zoom limit
    const fullScale = Math.min(svgWidth / boundsWidth, svgHeight / boundsHeight);

    // Get current zoom level
    const currentZoom = this.getZoom();
    const maxZoom = currentZoom * 1.5; // Limit to 1.5x current zoom

    // Apply maximum zoom limit
    const scale = Math.min(fullScale, maxZoom);

    // Calculate translation to center bounds
    const translateX = svgWidth / 2 - scale * (boundsX + boundsWidth / 2);
    const translateY = svgHeight / 2 - scale * (boundsY + boundsHeight / 2);

    // Apply zoom transform
    this.svg.transition().duration(750).call(
      this.zoom.transform,
      d3.zoomIdentity.translate(translateX, translateY).scale(scale)
    );

    console.log(`Zoomed to ${visibleNodes.length} visible nodes at scale ${scale.toFixed(2)} (max: ${maxZoom.toFixed(2)})`);
  }

  /**
   * Animate all nodes with a bounce effect for dramatic filter feedback
   */
  bounceAllNodes() {
    if (!this.nodeLayer) return;

    console.log('Bouncing visible nodes with shared physics simulation');

    // Collect only visible (non-filtered) nodes and their base transforms
    const nodeData = [];
    const self = this;
    this.nodeLayer.selectAll('.node')
      .each(function(d) {
        // Skip filtered out nodes - they should stay dimmed and not bounce
        if (self.filteredOutNodes && self.filteredOutNodes.has(d.id)) {
          return;
        }

        const node = d3.select(this);
        const currentTransform = node.attr('transform') || 'translate(0,0)';
        const translate = currentTransform.match(/translate\(([^)]+)\)/);
        let baseTransform = currentTransform;

        if (translate) {
          const coords = translate[1].split(',');
          const x = parseFloat(coords[0]);
          const y = parseFloat(coords[1]);
          baseTransform = `translate(${x},${y})`;
        }

        nodeData.push({ node, baseTransform });
      });

    if (nodeData.length === 0) return;

    // Pulse animation - time-based for consistency
    let currentPulse = 0;
    const totalPulses = 2;
    const pulseDuration = 500; // milliseconds per pulse
    const pauseBetweenPulses = 150; // milliseconds
    let pulseStartTime = null;

    const pulseStep = (timestamp) => {
      if (!pulseStartTime) pulseStartTime = timestamp;

      const elapsed = timestamp - pulseStartTime;
      const pulsePhase = Math.min(elapsed / pulseDuration, 1.0); // 0 to 1 progress

      // Calculate scale using sine wave for smooth pulse
      let scale;
      if (pulsePhase < 1.0) {
        // Smooth expansion and contraction using sine
        const sineValue = Math.sin(pulsePhase * Math.PI);
        scale = 1.0 + (sineValue * 0.3); // Pulse between 1.0 and 1.3
      } else {
        // Pulse complete
        scale = 1.0;
        currentPulse++;
        pulseStartTime = null; // Reset for next pulse

        // Check if all pulses are done
        if (currentPulse >= totalPulses) {
          // Final update to ensure scale is exactly 1.0
          nodeData.forEach(({ node, baseTransform }) => {
            node.attr('transform', baseTransform + ' scale(1)');
          });
          return;
        }

        // Small pause between pulses
        setTimeout(() => {
          requestAnimationFrame(pulseStep);
        }, pauseBetweenPulses);
        return;
      }

      // Apply current scale to all visible nodes simultaneously
      nodeData.forEach(({ node, baseTransform }) => {
        node.attr('transform', baseTransform + ` scale(${scale})`);
      });

      requestAnimationFrame(pulseStep);
    };

    // Start the pulse animation
    requestAnimationFrame(pulseStep);
  }

  /**
   * Reset all nodes and groups to their original pack layout positions
   */
  resetNodePositions() {
    if (!this.nodePositions.size && !this.groupPositions.size) return;
    
    // Animate groups back to original positions
    this.groupPositions.forEach((pos, groupId) => {
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
    this.nodePositions.forEach((pos, nodeId) => {
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
      this.updateAllEdgesAsync();
    }, 100);
  }
  
  /**
   * Fit the drawing to viewport on initial render
   */
  fitToView(packedRoot) {
    if (!packedRoot) return;
    
    // Get the bounds of all visible elements using our vertex structure
    const allElements = Array.from(this.vertexMap.values()).filter(vertex => !vertex.isVirtual);
    if (allElements.length === 0) return;
    
    // Calculate bounding box of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    allElements.forEach(vertex => {
      const x = vertex.x;
      const y = vertex.y;
      const radius = vertex.isGroup ? vertex.r : this.options.nodeRadius;
      
      minX = Math.min(minX, x - radius);
      minY = Math.min(minY, y - radius);
      maxX = Math.max(maxX, x + radius);
      maxY = Math.max(maxY, y + radius);
    });
    
    // Add some padding around the bounds
    const padding = 50;
    const contentWidth = maxX - minX + 2 * padding;
    const contentHeight = maxY - minY + 2 * padding;
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    
    // Calculate scale to fit content in viewport
    const viewportWidth = this.options.width;
    const viewportHeight = this.options.height;
    const scaleX = viewportWidth / contentWidth;
    const scaleY = viewportHeight / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1) * 1.33; // Zoom in 33% more than full fit for better readability
    
    // Calculate translation to center the content
    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;
    const translateX = viewportCenterX - contentCenterX * scale;
    const translateY = viewportCenterY - contentCenterY * scale;
    
    // Apply the transform immediately (no transition on initial render)
    const transform = d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale);
    
    this.svg.call(this.zoom.transform, transform);
    
    console.log(`Fit to view: scale=${scale.toFixed(2)}, translate=(${translateX.toFixed(0)}, ${translateY.toFixed(0)})`);
  }


  /**
   * Get current zoom level
   */
  getZoom() {
    if (!this.svg) return 1;
    return d3.zoomTransform(this.svg.node()).k;
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
}