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
    const nodes = packedRoot.descendants()
      .filter(d => !d.data.isGroup && !d.data.isVirtual);
    
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
      console.log('Rendering node:', d.data.id, 'with type:', nodeType, 'data:', d.data.data);
      
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
    
    nodeElements.call(dragBehavior);
  }
  
  /**
   * Render edges
   */
  renderEdges(packedRoot) {
    if (!this.data.edges) return;
    
    // Create position map
    const positionMap = new Map();
    packedRoot.descendants().forEach(d => {
      if (!d.data.isVirtual) {
        positionMap.set(d.data.id, { x: d.x + 25, y: d.y + 25 });
      }
    });
    
    // Filter edges to only those with both endpoints visible
    const visibleEdges = this.data.edges.filter(edge => {
      return positionMap.has(edge.source) && positionMap.has(edge.target);
    });
    
    const edgeElements = this.edgeLayer
      .selectAll('line.edge')
      .data(visibleEdges)
      .join('line')
      .attr('class', 'edge')
      .attr('x1', d => positionMap.get(d.source).x)
      .attr('y1', d => positionMap.get(d.source).y)
      .attr('x2', d => positionMap.get(d.target).x)
      .attr('y2', d => positionMap.get(d.target).y)
      .attr('stroke', '#888')  // Medium gray edges
      .attr('stroke-width', 1.5)  // Slightly thicker than original but not too thick
      .attr('opacity', 0.4);  // More transparent so they don't dominate over groups
      
    // Add arrowheads (simple triangles) to match G6 style
    const arrowElements = this.edgeLayer
      .selectAll('polygon.arrow')
      .data(visibleEdges)
      .join('polygon')
      .attr('class', 'arrow')
      .attr('points', '0,-3 8,0 0,3')
      .attr('fill', '#888')
      .attr('opacity', 0.4)  // More transparent to match edge lines
      .attr('transform', d => {
        const source = positionMap.get(d.source);
        const target = positionMap.get(d.target);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        // Position arrow at target end, offset by node radius
        const length = Math.sqrt(dx * dx + dy * dy);
        const offsetX = target.x - (dx / length) * (this.options.nodeRadius + 2);
        const offsetY = target.y - (dy / length) * (this.options.nodeRadius + 2);
        return `translate(${offsetX}, ${offsetY}) rotate(${angle})`;
      });
  }
  
  /**
   * Drag handlers
   */
  onDragStart(event, d) {
    // Change cursor
    d3.select(event.sourceEvent.target).style('cursor', 'grabbing');
  }
  
  onDrag(event, d) {
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
    // Reset cursor
    d3.select(event.sourceEvent.target).style('cursor', 'grab');
  }
  
  /**
   * Group drag handlers
   */
  onGroupDragStart(event, d) {
    // Change cursor
    d3.select(event.sourceEvent.target).style('cursor', 'grabbing');
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
  }
  
  onGroupDragEnd(event, d) {
    // Reset cursor
    d3.select(event.sourceEvent.target).style('cursor', 'grab');
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
   * Update edges connected to a node
   */
  updateConnectedEdges(nodeId) {
    if (!this.data.edges) return;
    
    const nodePos = this.nodePositions.get(nodeId);
    if (!nodePos) return;
    
    // Update edges where this node is source
    this.edgeLayer.selectAll('line.edge')
      .filter(d => d.source === nodeId)
      .attr('x1', nodePos.x)
      .attr('y1', nodePos.y);
    
    // Update edges where this node is target
    this.edgeLayer.selectAll('line.edge')
      .filter(d => d.target === nodeId)
      .attr('x2', nodePos.x)
      .attr('y2', nodePos.y);
    
    // Update arrows pointing to this node
    this.edgeLayer.selectAll('polygon.arrow')
      .filter(d => d.target === nodeId)
      .attr('transform', d => {
        const sourcePos = this.nodePositions.get(d.source);
        if (!sourcePos) return '';
        
        const dx = nodePos.x - sourcePos.x;
        const dy = nodePos.y - sourcePos.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const length = Math.sqrt(dx * dx + dy * dy);
        const offsetX = nodePos.x - (dx / length) * (this.options.nodeRadius + 2);
        const offsetY = nodePos.y - (dy / length) * (this.options.nodeRadius + 2);
        return `translate(${offsetX}, ${offsetY}) rotate(${angle})`;
      });
    
    // Update arrows originating from this node
    this.edgeLayer.selectAll('polygon.arrow')
      .filter(d => d.source === nodeId)
      .attr('transform', d => {
        const targetPos = this.nodePositions.get(d.target);
        if (!targetPos) return '';
        
        const dx = targetPos.x - nodePos.x;
        const dy = targetPos.y - nodePos.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const length = Math.sqrt(dx * dx + dy * dy);
        const offsetX = targetPos.x - (dx / length) * (this.options.nodeRadius + 2);
        const offsetY = targetPos.y - (dy / length) * (this.options.nodeRadius + 2);
        return `translate(${offsetX}, ${offsetY}) rotate(${angle})`;
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