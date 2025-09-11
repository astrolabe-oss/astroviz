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
function getDefaultDashPattern(node) {
  if (node.data.id.startsWith('app')) return '3,3';        // Short dash for apps
  if (node.data.id.startsWith('cluster')) return '8,4';     // Medium dash for clusters
  if (node.data.id === 'private-network') return '5,5';     // Default dash for private network
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
      padding: options.padding || 10,
      nodeRadius: options.nodeRadius || 15,
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
    
    // Selection and highlighting state
    this.selectedNodeIds = new Set();
    this.filterHighlightedNodes = new Set(); // Track filter-based highlights
    this.highlightedElements = {
      nodes: new Set(),
      edgeKeys: new Set() // Store "source-target" keys for persistence
    };
    
    this.init();
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
    
    // Build hierarchy from vertices
    const hierarchy = this.buildHierarchy();
    if (!hierarchy) return;
    
    // Calculate positions using D3 pack
    const packedRoot = this.calculatePack(hierarchy);
    if (!packedRoot) return;
    
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
    
    // Store group positions and track their children
    packedRoot.descendants().forEach(d => {
      if (!d.data.isVirtual) {
        const position = {
          x: d.x + 25,
          y: d.y + 25,
          originalX: d.x + 25,
          originalY: d.y + 25
        };
        
        if (d.data.isGroup) {
          position.r = d.r;
          position.originalR = d.r;
          position.children = d.children ? d.children.map(c => c.data.id) : [];
          this.groupPositions.set(d.data.id, position);
        } else {
          this.nodePositions.set(d.data.id, position);
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
    
    // Create vertex map - flatten the structure so D3 hierarchy will have clean d.data access
    const vertexMap = new Map();
    
    Object.entries(vertices).forEach(([id, vertex]) => {
      // Create a node with ALL vertex properties directly on it
      // This way, after D3 hierarchy processing, properties will be at d.data.*
      vertexMap.set(id, {
        ...vertex,           // Spread ALL vertex properties directly
        id,                  // Ensure id is set
        children: [],        // Initialize children array
        isGroup: vertex.type === 'group'  // Add convenience property
      });
    });
    
    // Build parent-child relationships
    Object.entries(vertices).forEach(([id, vertex]) => {
      if (vertex.parentId && vertexMap.has(vertex.parentId)) {
        const parent = vertexMap.get(vertex.parentId);
        const child = vertexMap.get(id);
        parent.children.push(child);
      }
    });
    
    // Find roots (nodes with no parentId)
    const roots = [];
    vertexMap.forEach(vertex => {
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
    const paddingFactor = this.options.padding / 200;  // Much smaller contribution
    
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
        // Only leaf nodes contribute to size
        return d.children && d.children.length > 0 ? 0 : 100;
      });
    
    const pack = d3.pack()
      .size([width - 50, height - 50])
      .padding(this.options.padding);
    
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
          r: this.options.nodeRadius || 25,
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
    const groups = packedRoot.descendants()
      .filter(d => d.data.isGroup && !d.data.isVirtual);
    
    const groupElements = this.groupLayer
      .selectAll('circle.group')
      .data(groups, d => d.data.id)
      .join('circle')
      .attr('class', 'group')
      .attr('id', d => `group-${d.data.id}`)
      .attr('cx', d => d.x + 25) // Offset for margin
      .attr('cy', d => d.y + 25)
      .attr('r', d => d.r)
      .style('cursor', 'grab')
      .on('click', (event, d) => {
        this.handleGroupClick(event, d);
      });
    
    // Apply all supported styles from the style object
    groupElements.each(function(d) {
      const element = d3.select(this);
      
      Object.entries(SUPPORTED_STYLES).forEach(([styleProp, config]) => {
        // Check for style in nested style object first, then fall back to legacy flat properties
        let value = d.data?.style?.[styleProp] ?? d.data?.[styleProp] ?? config.default;
        
        // Special handling for strokeDasharray - use type-based defaults if not specified
        if (styleProp === 'strokeDasharray' && !value && !d.data?.style?.strokeDasharray) {
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
      .data(groups, d => d.data.id)
      .join('g')
      .attr('class', 'group-label-container')
      .attr('id', d => `group-label-container-${d.data.id}`)
      .attr('transform', d => `translate(${d.x + 25}, ${d.y + 25 - d.r - 5})`);

    // Add label backgrounds
    groupLabelElements.each(function(d) {
      const group = d3.select(this);
      const labelText = d.data?.label || d.data.id;
      
      // Create temporary text to measure width
      const tempText = group.append('text')
        .attr('font-size', d.data.id === 'internet-boundary' || d.data.id === 'private-network' ? '16px' : 
                          d.data.id.startsWith('cluster') ? '14px' : '12px')
        .attr('font-weight', 'bold')
        .text(labelText)
        .style('visibility', 'hidden');
      
      const bbox = tempText.node().getBBox();
      tempText.remove();
      
      // Add background rectangle
      group.append('rect')
        .attr('x', -bbox.width/2 - 4)
        .attr('y', -bbox.height/2 - 2)
        .attr('width', bbox.width + 8)
        .attr('height', bbox.height + 4)
        .attr('rx', 3)
        .attr('fill', 'rgba(240, 240, 245, 0.85)')
        .attr('stroke', '#999')
        .attr('stroke-width', 1);
      
      // Add label text
      group.append('text')
        .attr('class', 'group-label')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-size', d.data.id === 'internet-boundary' || d.data.id === 'private-network' ? '16px' : 
                           d.data.id.startsWith('cluster') ? '14px' : '12px')
        .style('font-weight', 'bold')
        .style('fill', d.data.id === 'internet-boundary' || d.data.id === 'private-network' ? '#333' : '#555')
        .style('pointer-events', 'none')
        .text(labelText);
    });
    
    // Add drag behavior to groups
    const groupDragBehavior = d3.drag()
      .subject((event, d) => {
        // Initialize drag subject with current group position
        const pos = this.groupPositions.get(d.data.id);
        return pos ? { x: pos.x, y: pos.y } : { x: d.x + 25, y: d.y + 25 };
      })
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
    const nodes = packedRoot.descendants()
      .filter(d => !d.data.isGroup && !d.data.isVirtual);
    console.log('Found nodes:', nodes.length);
    
    // Create node elements to hold icons
    const nodeElements = this.nodeLayer
      .selectAll('g.node')
      .data(nodes, d => d.data.id)
      .join('g')
      .attr('class', 'node')
      .attr('id', d => `node-${d.data.id}`)
      .attr('transform', d => `translate(${d.x + 25}, ${d.y + 25})`)
      .style('cursor', 'grab')
      .on('click', (event, d) => {
        this.handleNodeClick(event, d);
      })
      .on('mouseover', (event, d) => {
        // Show tooltip on hover
        this.showTooltip(event, d.data);
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
          .style('color', d.data?.style?.fill ?? d.data?.fill ?? '#5B8FF9'); // Use node color from style object
        
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

    
    // Add drag behavior
    const dragBehavior = d3.drag()
      .subject((event, d) => {
        // Initialize drag subject with current node position
        const pos = this.nodePositions.get(d.data.id);
        return pos ? { x: pos.x, y: pos.y } : { x: d.x + 25, y: d.y + 25 };
      })
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
      
      // Create single line with appropriate styling
      this.edgeLayer
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
    console.log('=== onDragStart called ===', d.data.id);
    this.setCursor(event, 'grabbing');
  }
  
  onDrag(event, d) {
    // console.log('onDrag called for', d.data.id);
    const nodeId = d.data.id;
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
    console.log('=== onGroupDragStart called ===', d.data.id);
    this.setCursor(event, 'grabbing');
  }
  
  onGroupDrag(event, d) {
    const groupId = d.data.id;
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
    console.log('=== onGroupDragEnd called ===', d.data.id);
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
   * Highlight a node and its connected nodes/edges
   * @param {string} nodeId - ID of the node to highlight
   * @param {boolean} appendToSelection - Whether to add to existing selection (for multi-select)
   */
  highlightNode(nodeId, appendToSelection = false) {
    console.log("GraphRenderer: Highlighting node", nodeId, "append =", appendToSelection);

    // Only clear existing highlight if not appending
    if (!appendToSelection) {
      this.clearNodeHighlights();
    }

    // Add the new node to the selection
    this.selectedNodeIds.add(nodeId);

    // Get connected nodes and edges for ALL selected nodes (for multi-select traversal)
    let allConnectedNodes = new Set();
    let allConnectedEdges = [];

    this.selectedNodeIds.forEach(selectedId => {
      const { nodes: connectedNodes, edges: connectedEdges } = this.getConnectedNodes(selectedId);
      connectedNodes.forEach(id => allConnectedNodes.add(id));
      allConnectedEdges.push(...connectedEdges);
    });

    // Update highlighted elements tracking
    allConnectedNodes.forEach(id => this.highlightedElements.nodes.add(id));
    allConnectedEdges.forEach(edgeKey => this.highlightedElements.edgeKeys.add(edgeKey));

    // Apply visual highlighting to nodes
    const selectedNodeIds = this.selectedNodeIds; // Capture context for use in .each()
    this.nodeLayer.selectAll('.node')
      .filter(d => allConnectedNodes.has(d.data.id))
      .each(function(d) {
        const node = d3.select(this);
        
        // Get current transform and apply scaling to it
        const currentTransform = node.attr('transform') || 'translate(0,0)';
        const translate = currentTransform.match(/translate\(([^)]+)\)/);
        if (translate) {
          const coords = translate[1].split(',');
          const x = parseFloat(coords[0]);
          const y = parseFloat(coords[1]);

          // Apply scaling and styling - don't store transforms, just modify current
          const isDirectlySelected = selectedNodeIds.has(d.data.id);
          const scale = isDirectlySelected ? 1.2 : 1.1;
          const color = isDirectlySelected ? '#8A4FBE' : '#A875D4'; // Less intense purple for selected, lighter purple for connected
          
          node.attr('transform', `translate(${x},${y}) scale(${scale})`)
              .style('filter', 'drop-shadow(0 0 5px ' + color + ')')
              .classed('highlighted', true); // Mark as highlighted

          // Update SVG icon color
          const svgIcon = node.select('svg');
          if (!svgIcon.empty()) {
            // Store original color if not already stored
            if (!node.attr('data-original-color')) {
              const originalColor = svgIcon.style('color');
              node.attr('data-original-color', originalColor);
            }
            
            svgIcon.style('color', color);

            // Handle Unknown node special styling
            if (d.data?.type === 'Unknown') {
              svgIcon.select('circle').attr('fill', color);
              svgIcon.select('text').attr('fill', '#FFFFFF').attr('font-weight', 'bolder');
            }
          }
        }
      });

    // Apply highlighting to connected edges
    this.edgeLayer.selectAll('.edge')
      .each(function() {
        const edge = d3.select(this);
        const source = edge.attr('data-source');
        const target = edge.attr('data-target');
        const edgeKey = `${source}-${target}`;
        
        if (allConnectedEdges.includes(edgeKey)) {
          // Store original stroke properties if not already stored
          if (!edge.attr('data-original-stroke')) {
            edge.attr('data-original-stroke', edge.attr('stroke'))
                .attr('data-original-stroke-width', edge.attr('stroke-width'));
          }
          
          // Apply purple highlighting
          edge.attr('stroke', '#4444ff')
              .attr('stroke-width', 3);
        }
      });

    console.log("GraphRenderer: Highlighted", allConnectedNodes.size, "nodes and", allConnectedEdges.length, "edges for", this.selectedNodeIds.size, "selected nodes");
  }

  /**
   * Clear all manual selection highlighting (preserve filter highlights)
   */
  clearHighlight() {
    console.log("GraphRenderer: Clearing all manual selection highlights");

    // Clear node highlights
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
      .filter(d => d.data.id.startsWith('app-') && d.data.name === appName)
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
      .filter(d => d.data.id.startsWith('app-') && d.data.name === appName)
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
        const labelText = d.data?.label || d.data.id;
        
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
    if (d.data.id.startsWith('app-') && d.data.name) {
      this.handleApplicationGroupClick(event, d);
    } else {
      // For cluster/boundary groups, do nothing (no details panel)
      console.log('Non-application group clicked, ignoring:', d.data.id);
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
      this.emitClickEvent(d.data, event, 'group');
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
    this.highlightNode(d.data.id, event.shiftKey);
    
    // Emit node data
    this.emitClickEvent(d.data, event, 'node');
  }

  /**
   * Unified event emission with type information
   */
  emitClickEvent(data, event, type) {
    if (this.options.onNodeClick) {
      // Add metadata about click type
      const enrichedData = {
        ...data,
        _clickType: type
      };
      this.options.onNodeClick(enrichedData, event);
    }
  }

  /**
   * Clear only node highlights (not application highlights)
   */
  clearNodeHighlights() {
    // Clear ALL highlighted nodes from manual selection (including connected ones)
    this.highlightedElements.nodes.forEach(nodeId => {
      if (!this.filterHighlightedNodes.has(nodeId)) {
        this.unhighlightNode(nodeId);
      }
    });

    // Clear node selection state
    this.selectedNodeIds.clear();
    this.highlightedElements.nodes.clear();
    this.highlightedElements.edgeKeys.clear();
    
    // Re-render edges
    if (this.hierarchyRoot) {
      this.renderEdges(this.hierarchyRoot);
    }
  }

  /**
   * Apply visual highlighting to a single node (reused by both manual and filter highlighting)
   * @param {string} nodeId - Node ID to highlight
   * @param {boolean} isDirectlySelected - Whether this node is directly selected (vs connected)
   */
  applyNodeHighlighting(nodeId, isDirectlySelected = true) {
    const nodeElement = this.nodeLayer.select(`#node-${nodeId}`);
    if (nodeElement.empty()) return;

    nodeElement.each(function(d) {
      const node = d3.select(this);
      
      // Get current transform and apply scaling to it
      const currentTransform = node.attr('transform') || 'translate(0,0)';
      const translate = currentTransform.match(/translate\(([^)]+)\)/);
      if (translate) {
        const coords = translate[1].split(',');
        const x = parseFloat(coords[0]);
        const y = parseFloat(coords[1]);

        // Apply scaling and styling (less intense)
        const scale = isDirectlySelected ? 1.2 : 1.1;
        const color = isDirectlySelected ? '#8A4FBE' : '#A875D4';
        
        node.attr('transform', `translate(${x},${y}) scale(${scale})`)
            .style('filter', 'drop-shadow(0 0 5px ' + color + ')')
            .classed('highlighted', true);

        // Update SVG icon color
        const svgIcon = node.select('svg');
        if (!svgIcon.empty()) {
          // Store original color if not already stored
          if (!node.attr('data-original-color')) {
            const originalColor = svgIcon.style('color');
            node.attr('data-original-color', originalColor);
          }
          
          svgIcon.style('color', color);

          // Handle Unknown node special styling
          if (d.data.type === 'Unknown') {
            svgIcon.select('circle').attr('fill', color);
            svgIcon.select('text').attr('fill', '#FFFFFF').attr('font-weight', 'bolder');
          }
        }
      }
    });
  }

  /**
   * Remove visual highlighting from a single node
   * @param {string} nodeId - Node ID to unhighlight
   */
  unhighlightNode(nodeId) {
    const nodeElement = this.nodeLayer.select(`#node-${nodeId}`);
    if (nodeElement.empty()) return;

    nodeElement.each(function(d) {
      const node = d3.select(this);
      
      // Remove scaling from current transform but keep position
      const currentTransform = node.attr('transform') || 'translate(0,0)';
      const translate = currentTransform.match(/translate\(([^)]+)\)/);
      if (translate) {
        const coords = translate[1].split(',');
        const x = parseFloat(coords[0]);
        const y = parseFloat(coords[1]);
        // Reset to scale(1)
        node.attr('transform', `translate(${x},${y}) scale(1)`);
      }

      // Remove drop shadow and highlighting class
      node.style('filter', null)
          .classed('highlighted', false);

      // Restore original color
      const originalColor = node.attr('data-original-color');
      if (originalColor) {
        const svgIcon = node.select('svg');
        svgIcon.style('color', originalColor);

        // Restore Unknown node special styling
        if (d.data?.type === 'Unknown') {
          svgIcon.select('circle').attr('fill', '#F9C96E');
          svgIcon.select('text').attr('fill', '#666666').attr('font-weight', 'bold');
        }

        // Clear stored color data
        node.attr('data-original-color', null);
      }
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
    
    // Get the bounds of all visible elements
    const allElements = packedRoot.descendants().filter(d => !d.data.isVirtual);
    if (allElements.length === 0) return;
    
    // Calculate bounding box of all elements (including the 25px offset)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    allElements.forEach(d => {
      const x = d.x + 25;
      const y = d.y + 25;
      const radius = d.data.isGroup ? d.r : this.options.nodeRadius;
      
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
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 1x
    
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