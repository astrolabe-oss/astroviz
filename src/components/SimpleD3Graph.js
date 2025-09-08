import * as d3 from 'd3';
import networkIcons from './networkIcons';

/**
 * SimpleD3Graph - Basic D3 hierarchical graph renderer
 * Just renders vertices and edges with circle packing - no interactions
 */
export class SimpleD3Graph {
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
      .attr('width', this.options.width)
      .attr('height', this.options.height)
      .style('background', '#f8f9fa');
    
    // Add definitions for gradients
    this.defs = this.svg.append('defs');
    
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
    
    // Create vertex map
    const vertexMap = new Map();
    
    Object.entries(vertices).forEach(([id, vertex]) => {
      // Determine if this is a group based on whether it has child elements
      // Groups are marked with type === 'group' from GraphVisualization.vue
      const isGroup = vertex.type === 'group';
      
      vertexMap.set(id, {
        id,
        data: vertex,        // Preserve original vertex data
        children: [],
        isGroup: isGroup
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
    
    // Find roots
    const roots = [];
    vertexMap.forEach(vertex => {
      const hasParent = Object.values(vertices).some(v => v.parentId === vertex.id);
      if (!vertex.data.parentId) {
        roots.push(vertex);
      }
    });
    
    // Create virtual root if needed
    if (roots.length === 1) {
      return roots[0];
    } else {
      return {
        id: 'virtual-root',
        children: roots,
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
   * Calculate circle packing layout
   */
  calculatePack(hierarchyRoot) {
    // Calculate optimal canvas size based on graph complexity
    const { width, height } = this.calculateOptimalCanvasSize(hierarchyRoot);
    
    // Create D3 hierarchy
    const root = d3.hierarchy(hierarchyRoot)
      .sum(d => {
        // Only leaf nodes contribute to size
        return d.children && d.children.length > 0 ? 0 : 100;
      });
    
    // Create pack layout with intelligently sized canvas
    const pack = d3.pack()
      .size([width - 50, height - 50])
      .padding(this.options.padding);
    
    return pack(root);
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
      .attr('fill', d => d.data.data?.fill || 'none')
      .attr('stroke', d => d.data.data?.stroke || '#5B8FF9')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', d => {
        // Different dash patterns based on hierarchy level
        if (d.data.id.startsWith('app')) return '3,3';        // Short dash for apps
        if (d.data.id.startsWith('cluster')) return '8,4';     // Medium dash for clusters
        return '5,5';                                          // Default dash for private network
      })
      .attr('opacity', 0.6)
      .style('cursor', 'grab');
    
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
      const labelText = d.data.data?.label || d.data.id;
      
      // Create temporary text to measure width
      const tempText = group.append('text')
        .attr('font-size', d.data.id === 'private-network' ? '16px' : 
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
        .style('font-size', d.data.id === 'private-network' ? '16px' : 
                           d.data.id.startsWith('cluster') ? '14px' : '12px')
        .style('font-weight', 'bold')
        .style('fill', d.data.id === 'private-network' ? '#333' : '#555')
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
      .style('cursor', 'grab');

    // Add icons to node elements (like the old GraphVisualization.vue)
    const self = this;
    nodeElements.each(function(d) {
      const group = d3.select(this);
      
      // Since we spread all vertex data at root level in GraphVisualization.vue, 
      // the type is now directly accessible on d.data.data
      const nodeType = d.data.data?.type || 'Unknown';
      
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
          .style('color', d.data.data?.fill || '#5B8FF9'); // Use node color
        
        // Insert the icon content
        iconSvg.html(svgElement.innerHTML);
      }
    });
    
    // Node labels (dark text, no background)
    const labelElements = this.labelLayer
      .selectAll('text.node-label')
      .data(nodes, d => d.data.id)
      .join('text')
      .attr('class', 'node-label')
      .attr('id', d => `node-label-${d.data.id}`)
      .attr('x', d => d.x + 25)
      .attr('y', d => d.y + 25 + this.options.nodeRadius + 8) // Position below the icon
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#333')
      .style('font-weight', 'normal')
      .style('pointer-events', 'none')
      .text(d => this.getNodeLabel(d.data.data) || d.data.id);
    
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
   * Convert segment data to gradient stops
   */
  segmentsToGradientStops(segments) {
    if (segments.length === 0) return [];
    
    const stops = [];
    let currentOffset = 0;
    
    // Calculate total length for percentage calculation
    let totalLength = 0;
    segments.forEach(segment => {
      const dx = segment.x2 - segment.x1;
      const dy = segment.y2 - segment.y1;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    });
    
    segments.forEach((segment, index) => {
      const dx = segment.x2 - segment.x1;
      const dy = segment.y2 - segment.y1;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      const segmentPercent = (segmentLength / totalLength) * 100;
      
      // Add stop at start of segment
      const startPercent = currentOffset;
      const endPercent = currentOffset + segmentPercent;
      
      if (segment.insideUnrelatedGroup) {
        // Light styling for unrelated segments
        stops.push({
          offset: `${startPercent}%`,
          color: '#ccc',
          opacity: 0.2
        });
        stops.push({
          offset: `${endPercent}%`,
          color: '#ccc', 
          opacity: 0.2
        });
      } else {
        // Solid styling for related segments
        stops.push({
          offset: `${startPercent}%`,
          color: '#888',
          opacity: 0.4
        });
        stops.push({
          offset: `${endPercent}%`,
          color: '#888',
          opacity: 0.4
        });
      }
      
      currentOffset = endPercent;
    });
    
    return stops;
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
    
    // Create position map for nodes
    const positionMap = new Map();
    packedRoot.descendants().forEach(d => {
      if (!d.data.isVirtual) {
        positionMap.set(d.data.id, { x: d.x + 25, y: d.y + 25 });
      }
    });
    
    // Create group circles map for intersection detection
    // Separate application and cluster groups
    const applicationGroups = [];
    const clusterGroups = [];
    const allGroupCircles = [];
    
    // Build maps of which nodes belong to which groups
    const nodeToAppMap = new Map();
    const nodeToClusterMap = new Map();
    
    packedRoot.descendants().forEach(d => {
      if (d.data.isGroup && !d.data.isVirtual) {
        const circle = {
          id: d.data.id,
          x: d.x + 25,
          y: d.y + 25,
          r: d.r,
          isApp: d.data.id.startsWith('app-'),
          isCluster: d.data.id.startsWith('cluster')
        };
        allGroupCircles.push(circle);
        
        // Track application groups
        if (circle.isApp) {
          applicationGroups.push(circle);
          
          // Map all child nodes to this application
          if (d.children) {
            const mapChildNodes = (node) => {
              if (!node.data.isGroup) {
                nodeToAppMap.set(node.data.id, d.data.id);
              }
              if (node.children) {
                node.children.forEach(mapChildNodes);
              }
            };
            d.children.forEach(mapChildNodes);
          }
        }
        
        // Track cluster groups
        if (circle.isCluster) {
          clusterGroups.push(circle);
          
          // Map all child nodes to this cluster
          if (d.children) {
            const mapChildNodes = (node) => {
              if (!node.data.isGroup) {
                nodeToClusterMap.set(node.data.id, d.data.id);
              }
              if (node.children) {
                node.children.forEach(mapChildNodes);
              }
            };
            d.children.forEach(mapChildNodes);
          }
        }
      }
    });
    
    // Filter edges to only those with both endpoints visible
    const visibleEdges = this.data.edges.filter(edge => {
      return positionMap.has(edge.source) && positionMap.has(edge.target);
    });
    
    // Clear existing edges
    this.edgeLayer.selectAll('line.edge').remove();
    
    // Create single gradient edges using segment data
    visibleEdges.forEach((edge, edgeIndex) => {
      // Find home applications and clusters for this edge
      const homeApps = new Set();
      const homeClusters = new Set();
      
      const sourceApp = nodeToAppMap.get(edge.source);
      const targetApp = nodeToAppMap.get(edge.target);
      if (sourceApp) homeApps.add(sourceApp);
      if (targetApp) homeApps.add(targetApp);
      
      const sourceCluster = nodeToClusterMap.get(edge.source);
      const targetCluster = nodeToClusterMap.get(edge.target);
      if (sourceCluster) homeClusters.add(sourceCluster);
      if (targetCluster) homeClusters.add(targetCluster);
      
      const segments = this.calculateEdgeSegmentsWithGroups(
        edge, 
        positionMap, 
        applicationGroups,
        clusterGroups, 
        homeApps,
        homeClusters
      );
      
      // Convert segments to gradient stops
      const gradientStops = this.segmentsToGradientStops(segments);
      
      // Create unique edge ID
      const edgeId = `${edge.source}-${edge.target}-${edgeIndex}`;
      
      // Get source and target positions
      const sourcePos = positionMap.get(edge.source);
      const targetPos = positionMap.get(edge.target);
      
      // Create gradient for this edge
      const gradientUrl = this.createEdgeGradient(
        edgeId, 
        gradientStops, 
        sourcePos.x, 
        sourcePos.y, 
        targetPos.x, 
        targetPos.y
      );
      
      // Create single line with gradient
      this.edgeLayer
        .append('line')
        .attr('class', 'edge')
        .attr('data-source', edge.source)
        .attr('data-target', edge.target)
        .attr('data-edge-id', edgeId)
        .attr('x1', sourcePos.x)
        .attr('y1', sourcePos.y)
        .attr('x2', targetPos.x)
        .attr('y2', targetPos.y)
        .attr('stroke', gradientUrl)
        .attr('stroke-width', 1.5);
    });
      
    // Add arrowheads (simple triangles) - one per edge
    this.edgeLayer.selectAll('polygon.arrow').remove();
    
    visibleEdges.forEach(edge => {
      const source = positionMap.get(edge.source);
      const target = positionMap.get(edge.target);
      
      if (!source || !target) return;
      
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      
      // Position arrow at target end, offset by node radius
      const length = Math.sqrt(dx * dx + dy * dy);
      const offsetX = target.x - (dx / length) * (this.options.nodeRadius + 2);
      const offsetY = target.y - (dy / length) * (this.options.nodeRadius + 2);
      
      // Check if arrow position is inside any unrelated application
      let arrowInsideUnrelatedApp = false;
      for (const app of applicationGroups) {
        if (this.pointInCircle({ x: offsetX, y: offsetY }, app)) {
          // Check if this app is NOT a home app
          const sourceApp = nodeToAppMap.get(edge.source);
          const targetApp = nodeToAppMap.get(edge.target);
          if (app.id !== sourceApp && app.id !== targetApp) {
            arrowInsideUnrelatedApp = true;
            break;
          }
        }
      }
      
      this.edgeLayer
        .append('polygon')
        .attr('class', 'arrow')
        .attr('points', '0,-3 8,0 0,3')
        .attr('fill', arrowInsideUnrelatedApp ? '#ccc' : '#888')
        .attr('opacity', arrowInsideUnrelatedApp ? 0.2 : 0.4)
        .attr('transform', `translate(${offsetX}, ${offsetY}) rotate(${angle})`);
    });
  }
  
  /**
   * Drag handlers
   */
  onDragStart(event, d) {
    console.log('=== onDragStart called ===', d.data.id);
    // Change cursor
    d3.select(event.sourceEvent.target).style('cursor', 'grabbing');
  }
  
  onDrag(event, d) {
    console.log('onDrag called for', d.data.id);
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
    
    // Move the node label
    d3.select(`#node-label-${nodeId}`)
      .attr('x', event.x)
      .attr('y', event.y + this.options.nodeRadius + 8);
    
    // Update connected edges
    this.updateConnectedEdges(nodeId);
  }
  
  onDragEnd(event, d) {
    console.log('=== onDragEnd called ===');
    // Reset cursor
    d3.select(event.sourceEvent.target).style('cursor', 'grab');
    
    // Update the packed root coordinates to match current positions
    if (this.hierarchyRoot) {
      console.log('Has hierarchyRoot, syncing positions...');
      this.hierarchyRoot.descendants().forEach(node => {
        if (!node.data.isVirtual) {
          const currentPos = this.nodePositions.get(node.data.id) || this.groupPositions.get(node.data.id);
          if (currentPos) {
            console.log(`Syncing ${node.data.id}: (${node.x}, ${node.y}) -> (${currentPos.x - 25}, ${currentPos.y - 25})`);
            node.x = currentPos.x - 25;  // Subtract offset used in renderEdges
            node.y = currentPos.y - 25;
          }
        }
      });
      
      console.log('Calling renderEdges...');
      // Now re-render all edges with updated positions
      this.renderEdges(this.hierarchyRoot);
      console.log('renderEdges complete');
    } else {
      console.log('NO hierarchyRoot available!');
    }
  }
  
  /**
   * Group drag handlers
   */
  onGroupDragStart(event, d) {
    console.log('=== onGroupDragStart called ===', d.data.id);
    // Change cursor
    d3.select(event.sourceEvent.target).style('cursor', 'grabbing');
  }
  
  onGroupDrag(event, d) {
    console.log('onGroupDrag called for', d.data.id);
    const groupId = d.data.id;
    const groupPos = this.groupPositions.get(groupId);
    if (!groupPos) return;
    
    // Calculate movement delta
    const deltaX = event.x - groupPos.x;
    const deltaY = event.y - groupPos.y;
    
    // Update the group position and move all children
    this.moveGroupAndChildren(groupId, deltaX, deltaY);
  }
  
  onGroupDragEnd(event, d) {
    console.log('=== onGroupDragEnd called ===', d.data.id);
    // Reset cursor
    d3.select(event.sourceEvent.target).style('cursor', 'grab');
    
    // Sync hierarchyRoot with current group positions before re-rendering
    if (this.hierarchyRoot) {
      console.log('Syncing group positions to hierarchyRoot...');
      
      // Update all positions in hierarchyRoot to match current drag positions
      this.hierarchyRoot.descendants().forEach(node => {
        if (node.data.isGroup) {
          const groupPos = this.groupPositions.get(node.data.id);
          if (groupPos) {
            console.log(`Syncing group ${node.data.id}: (${node.x}, ${node.y}) -> (${groupPos.x - 25}, ${groupPos.y - 25})`);
            node.x = groupPos.x - 25;
            node.y = groupPos.y - 25;
          }
        } else if (!node.data.isVirtual) {
          const nodePos = this.nodePositions.get(node.data.id);
          if (nodePos) {
            node.x = nodePos.x - 25;
            node.y = nodePos.y - 25;
          }
        }
      });
      
      console.log('Re-rendering edges...');
      this.renderEdges(this.hierarchyRoot);
    }
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
        
        d3.select(`#node-label-${childId}`)
          .attr('x', childNodePos.x)
          .attr('y', childNodePos.y + this.options.nodeRadius + 8);
        
        // Update edges connected to this node
        this.updateConnectedEdges(childId);
        
      } else if (childGroupPos) {
        // Recursively move child group
        this.moveGroupAndChildren(childId, deltaX, deltaY);
      }
    });
  }
  
  /**
   * Calculate edge segments based on application and cluster intersections
   */
  calculateEdgeSegmentsWithGroups(edge, positionMap, applicationGroups, clusterGroups, homeApps, homeClusters) {
    const sourcePos = positionMap.get(edge.source);
    const targetPos = positionMap.get(edge.target);
    
    if (!sourcePos || !targetPos) return [];
    
    // Combine all groups we need to check for intersections
    const allGroups = [...applicationGroups, ...clusterGroups];
    
    // Start with the full edge as one segment
    const points = [
      { t: 0, x: sourcePos.x, y: sourcePos.y, insideUnrelatedGroup: false },
      { t: 1, x: targetPos.x, y: targetPos.y, insideUnrelatedGroup: false }
    ];
    
    // Find all intersection points with groups
    for (const group of allGroups) {
      const intersections = this.getLineCircleIntersections(sourcePos, targetPos, group);
      
      for (const intersection of intersections) {
        // Add intersection points
        points.push({
          t: intersection.t,
          x: intersection.x,
          y: intersection.y,
          insideUnrelatedGroup: false // Will be determined later
        });
      }
    }
    
    // Sort points by parameter t (position along line)
    points.sort((a, b) => a.t - b.t);
    
    // Remove duplicates (very close points)
    const uniquePoints = [];
    for (const point of points) {
      if (uniquePoints.length === 0 || Math.abs(point.t - uniquePoints[uniquePoints.length - 1].t) > 0.001) {
        uniquePoints.push(point);
      }
    }
    
    // Determine which segments are inside unrelated groups
    const segments = [];
    for (let i = 0; i < uniquePoints.length - 1; i++) {
      const start = uniquePoints[i];
      const end = uniquePoints[i + 1];
      
      // Check midpoint to determine if segment is inside any group
      const midT = (start.t + end.t) / 2;
      const midX = sourcePos.x + midT * (targetPos.x - sourcePos.x);
      const midY = sourcePos.y + midT * (targetPos.y - sourcePos.y);
      
      let insideUnrelatedGroup = false;
      
      // Check if inside any unrelated application
      for (const appGroup of applicationGroups) {
        if (this.pointInCircle({ x: midX, y: midY }, appGroup)) {
          // Check if this app is NOT a home app
          if (!homeApps.has(appGroup.id)) {
            insideUnrelatedGroup = true;
            break;
          }
        }
      }
      
      // Check if inside any unrelated cluster (only if not already marked)
      if (!insideUnrelatedGroup) {
        for (const clusterGroup of clusterGroups) {
          if (this.pointInCircle({ x: midX, y: midY }, clusterGroup)) {
            // Check if this cluster is NOT a home cluster
            if (!homeClusters.has(clusterGroup.id)) {
              insideUnrelatedGroup = true;
              break;
            }
          }
        }
      }
      
      segments.push({
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        insideUnrelatedGroup: insideUnrelatedGroup
      });
    }
    
    return segments;
  }

  /**
   * Calculate edge segments based on application intersections
   */
  calculateEdgeSegmentsWithApps(edge, positionMap, applicationGroups, homeApps) {
    const sourcePos = positionMap.get(edge.source);
    const targetPos = positionMap.get(edge.target);
    
    if (!sourcePos || !targetPos) return [];
    
    // Start with the full edge as one segment
    const points = [
      { t: 0, x: sourcePos.x, y: sourcePos.y, insideUnrelatedApp: false },
      { t: 1, x: targetPos.x, y: targetPos.y, insideUnrelatedApp: false }
    ];
    
    // Find all intersection points with application groups
    for (const appCircle of applicationGroups) {
      const intersections = this.getLineCircleIntersections(sourcePos, targetPos, appCircle);
      
      for (const intersection of intersections) {
        // Add intersection points
        points.push({
          t: intersection.t,
          x: intersection.x,
          y: intersection.y,
          insideUnrelatedApp: false // Will be determined later
        });
      }
    }
    
    // Sort points by parameter t (position along line)
    points.sort((a, b) => a.t - b.t);
    
    // Remove duplicates (very close points)
    const uniquePoints = [];
    for (const point of points) {
      if (uniquePoints.length === 0 || Math.abs(point.t - uniquePoints[uniquePoints.length - 1].t) > 0.001) {
        uniquePoints.push(point);
      }
    }
    
    // Determine which segments are inside unrelated applications
    const segments = [];
    for (let i = 0; i < uniquePoints.length - 1; i++) {
      const start = uniquePoints[i];
      const end = uniquePoints[i + 1];
      
      // Check midpoint to determine if segment is inside any application
      const midT = (start.t + end.t) / 2;
      const midX = sourcePos.x + midT * (targetPos.x - sourcePos.x);
      const midY = sourcePos.y + midT * (targetPos.y - sourcePos.y);
      
      // Check if inside any unrelated application
      let insideUnrelatedApp = false;
      for (const appCircle of applicationGroups) {
        if (this.pointInCircle({ x: midX, y: midY }, appCircle)) {
          // Check if this app is NOT a home app
          if (!homeApps.has(appCircle.id)) {
            insideUnrelatedApp = true;
            break;
          }
        }
      }
      
      segments.push({
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        insideUnrelatedApp: insideUnrelatedApp
      });
    }
    
    return segments;
  }

  /**
   * Calculate edge segments based on group intersections
   */
  calculateEdgeSegments(edge, positionMap, groupCircles) {
    const sourcePos = positionMap.get(edge.source);
    const targetPos = positionMap.get(edge.target);
    
    if (!sourcePos || !targetPos) return [];
    
    // Start with the full edge as one segment
    const points = [
      { t: 0, x: sourcePos.x, y: sourcePos.y, insideGroup: false },
      { t: 1, x: targetPos.x, y: targetPos.y, insideGroup: false }
    ];
    
    // Find all intersection points with group circles
    for (const circle of groupCircles) {
      const intersections = this.getLineCircleIntersections(sourcePos, targetPos, circle);
      
      for (const intersection of intersections) {
        // Add intersection points
        points.push({
          t: intersection.t,
          x: intersection.x,
          y: intersection.y,
          insideGroup: false // Will be determined later
        });
      }
    }
    
    // Sort points by parameter t (position along line)
    points.sort((a, b) => a.t - b.t);
    
    // Remove duplicates (very close points)
    const uniquePoints = [];
    for (const point of points) {
      if (uniquePoints.length === 0 || Math.abs(point.t - uniquePoints[uniquePoints.length - 1].t) > 0.001) {
        uniquePoints.push(point);
      }
    }
    
    // Determine which segments are inside groups
    const segments = [];
    for (let i = 0; i < uniquePoints.length - 1; i++) {
      const start = uniquePoints[i];
      const end = uniquePoints[i + 1];
      
      // Check midpoint to determine if segment is inside any group
      const midT = (start.t + end.t) / 2;
      const midX = sourcePos.x + midT * (targetPos.x - sourcePos.x);
      const midY = sourcePos.y + midT * (targetPos.y - sourcePos.y);
      
      const insideGroup = groupCircles.some(circle => 
        this.pointInCircle({ x: midX, y: midY }, circle)
      );
      
      segments.push({
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        insideGroup: insideGroup
      });
    }
    
    return segments;
  }

  /**
   * Get all intersection points between a line segment and a circle
   */
  getLineCircleIntersections(p1, p2, circle) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const fx = p1.x - circle.x;
    const fy = p1.y - circle.y;
    
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = (fx * fx + fy * fy) - circle.r * circle.r;
    
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) return []; // No intersection
    
    const intersections = [];
    const sqrt_discriminant = Math.sqrt(discriminant);
    
    // Check both intersection points
    const t1 = (-b - sqrt_discriminant) / (2 * a);
    const t2 = (-b + sqrt_discriminant) / (2 * a);
    
    if (t1 >= 0 && t1 <= 1) {
      intersections.push({
        t: t1,
        x: p1.x + t1 * dx,
        y: p1.y + t1 * dy
      });
    }
    
    if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 0.001) {
      intersections.push({
        t: t2,
        x: p1.x + t2 * dx,
        y: p1.y + t2 * dy
      });
    }
    
    return intersections;
  }

  /**
   * Check if an edge intersects with any group circles
   */
  edgeIntersectsGroups(edge, positionMap, groupCircles) {
    const sourcePos = positionMap.get(edge.source);
    const targetPos = positionMap.get(edge.target);
    
    if (!sourcePos || !targetPos) return false;
    
    // Check intersection with each group circle
    for (const circle of groupCircles) {
      // Skip if either endpoint is inside this circle (edge originates/terminates within group)
      const sourceInside = this.pointInCircle(sourcePos, circle);
      const targetInside = this.pointInCircle(targetPos, circle);
      
      if (sourceInside || targetInside) continue;
      
      // Check if line segment intersects the circle
      if (this.lineIntersectsCircle(sourcePos, targetPos, circle)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if a point is inside a circle
   */
  pointInCircle(point, circle) {
    const dx = point.x - circle.x;
    const dy = point.y - circle.y;
    return (dx * dx + dy * dy) <= (circle.r * circle.r);
  }

  /**
   * Check if a line segment intersects with a circle
   */
  lineIntersectsCircle(p1, p2, circle) {
    // Vector from p1 to p2
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    
    // Vector from p1 to circle center
    const fx = p1.x - circle.x;
    const fy = p1.y - circle.y;
    
    // Quadratic equation coefficients for line-circle intersection
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = (fx * fx + fy * fy) - circle.r * circle.r;
    
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) return false; // No intersection
    
    // Check if intersection points are within the line segment
    const sqrt_discriminant = Math.sqrt(discriminant);
    const t1 = (-b - sqrt_discriminant) / (2 * a);
    const t2 = (-b + sqrt_discriminant) / (2 * a);
    
    // Intersection occurs if either t value is between 0 and 1 (within segment)
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
  }

  /**
   * Update edges connected to a node - fast version for drag operations
   */
  updateConnectedEdges(nodeId) {
    if (!this.data.edges) return;
    
    const nodePos = this.nodePositions.get(nodeId);
    if (!nodePos) return;
    
    // Update line coordinates for edges connected to this node
    this.edgeLayer.selectAll('line.edge')
      .filter(function() {
        const source = d3.select(this).attr('data-source');
        const target = d3.select(this).attr('data-target');
        return source === nodeId || target === nodeId;
      })
      .each((d, i, nodes) => {
        const element = d3.select(nodes[i]);
        const source = element.attr('data-source');
        const target = element.attr('data-target');
        
        // Get updated positions
        const sourcePos = this.nodePositions.get(source);
        const targetPos = this.nodePositions.get(target);
        
        if (sourcePos && targetPos) {
          // Update line coordinates
          element
            .attr('x1', sourcePos.x)
            .attr('y1', sourcePos.y)
            .attr('x2', targetPos.x)
            .attr('y2', targetPos.y);
          
          // Update gradient coordinates (without regenerating stops)
          const edgeId = element.attr('data-edge-id');
          if (edgeId) {
            this.defs.select(`#edge-gradient-${edgeId}`)
              .attr('x1', sourcePos.x)
              .attr('y1', sourcePos.y)
              .attr('x2', targetPos.x)
              .attr('y2', targetPos.y);
          }
        }
      });
    
    // Update arrows
    this.edgeLayer.selectAll('polygon.arrow')
      .filter(function() {
        const source = d3.select(this).attr('data-source');
        const target = d3.select(this).attr('data-target');
        return source === nodeId || target === nodeId;
      })
      .attr('transform', (d, i, nodes) => {
        const element = d3.select(nodes[i]);
        const source = element.attr('data-source');
        const target = element.attr('data-target');
        
        const sourcePos = this.nodePositions.get(source);
        const targetPos = this.nodePositions.get(target);
        
        if (!sourcePos || !targetPos) return '';
        
        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const length = Math.sqrt(dx * dx + dy * dy);
        const offsetX = targetPos.x - (dx / length) * (this.options.nodeRadius + 2);
        const offsetY = targetPos.y - (dy / length) * (this.options.nodeRadius + 2);
        
        return `translate(${offsetX}, ${offsetY}) rotate(${angle})`;
      });
  }
  
  
  /**
   * Helper to get edge segments for updates (simplified version)
   */
  getEdgeSegmentsForUpdate(edge, sourcePos, targetPos) {
    // Simplified segment calculation for drag updates
    // For better performance during drag, we could cache group positions
    const applicationGroups = [];
    const clusterGroups = [];
    const homeApps = new Set();
    const homeClusters = new Set();
    
    // Build groups from current positions
    this.groupPositions.forEach((pos, id) => {
      if (id.startsWith('app-')) {
        applicationGroups.push({ id, x: pos.x, y: pos.y, r: pos.r });
      } else if (id.startsWith('cluster')) {
        clusterGroups.push({ id, x: pos.x, y: pos.y, r: pos.r });
      }
    });
    
    // Quick home group detection
    for (const app of applicationGroups) {
      const sourceDist = Math.sqrt((sourcePos.x - app.x) ** 2 + (sourcePos.y - app.y) ** 2);
      const targetDist = Math.sqrt((targetPos.x - app.x) ** 2 + (targetPos.y - app.y) ** 2);
      if (sourceDist <= app.r || targetDist <= app.r) {
        homeApps.add(app.id);
      }
    }
    
    for (const cluster of clusterGroups) {
      const sourceDist = Math.sqrt((sourcePos.x - cluster.x) ** 2 + (sourcePos.y - cluster.y) ** 2);
      const targetDist = Math.sqrt((targetPos.x - cluster.x) ** 2 + (targetPos.y - cluster.y) ** 2);
      if (sourceDist <= cluster.r || targetDist <= cluster.r) {
        homeClusters.add(cluster.id);
      }
    }
    
    const positionMap = new Map();
    positionMap.set(edge.source, sourcePos);
    positionMap.set(edge.target, targetPos);
    
    return this.calculateEdgeSegmentsWithGroups(
      edge, 
      positionMap, 
      applicationGroups,
      clusterGroups, 
      homeApps,
      homeClusters
    );
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
        
        // Animate label back to original position
        d3.select(`#node-label-${nodeId}`)
          .transition()
          .duration(500)
          .attr('x', pos.originalX)
          .attr('y', pos.originalY + this.options.nodeRadius + 8);
      }
    });
    
    // Update all edges after a brief delay to let nodes animate
    setTimeout(() => {
      this.nodePositions.forEach((pos, nodeId) => {
        this.updateConnectedEdges(nodeId);
      });
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
   * Get node label based on vertex type (matching old GraphVisualization.vue)
   */
  getNodeLabel(vertex) {
    if (!vertex) return '';
    
    const type = vertex.type;
    if (type in ['Application', 'Deployment', 'TrafficController']) return vertex.name;
    if (type in ['Compute', 'Resource']) return vertex.address;
    if (type === 'InternetIP') return `${vertex.address} (${vertex.name})`;
    return vertex.name || vertex.type;
  }

  /**
   * Get current zoom level
   */
  getZoom() {
    if (!this.svg) return 1;
    return d3.zoomTransform(this.svg.node()).k;
  }
  
  /**
   * Cleanup
   */
  destroy() {
    d3.select(this.container).selectAll('*').remove();
    this.nodePositions.clear();
    this.groupPositions.clear();
  }
}