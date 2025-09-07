import * as d3 from 'd3';

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
    
    // Create layers
    this.edgeLayer = this.g.append('g').attr('class', 'edges');
    this.groupLayer = this.g.append('g').attr('class', 'groups');
    this.nodeLayer = this.g.append('g').attr('class', 'nodes');
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
  }
  
  /**
   * Store node positions from pack layout
   */
  storeNodePositions(packedRoot) {
    this.nodePositions.clear();
    
    packedRoot.descendants().forEach(d => {
      if (!d.data.isVirtual && !d.data.isGroup) {
        this.nodePositions.set(d.data.id, {
          x: d.x + 25,
          y: d.y + 25
        });
      }
    });
  }
  
  /**
   * Build hierarchy from vertices data
   */
  buildHierarchy() {
    const vertices = this.data.vertices;
    if (!vertices) return null;
    
    // Create vertex map
    const vertexMap = new Map();
    
    Object.entries(vertices).forEach(([id, vertex]) => {
      vertexMap.set(id, {
        id,
        data: vertex,
        children: [],
        isGroup: vertex.type === 'group'
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
   * Calculate circle packing layout
   */
  calculatePack(hierarchyRoot) {
    // Create D3 hierarchy
    const root = d3.hierarchy(hierarchyRoot)
      .sum(d => {
        // Only leaf nodes contribute to size
        return d.children && d.children.length > 0 ? 0 : 100;
      });
    
    // Create pack layout
    const pack = d3.pack()
      .size([this.options.width - 50, this.options.height - 50])
      .padding(this.options.padding);
    
    return pack(root);
  }
  
  /**
   * Render group circles
   */
  renderGroups(packedRoot) {
    const groups = packedRoot.descendants()
      .filter(d => d.data.isGroup && !d.data.isVirtual);
    
    this.groupLayer
      .selectAll('circle.group')
      .data(groups)
      .join('circle')
      .attr('class', 'group')
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
      .attr('opacity', 0.6);
    
    // Group labels
    this.groupLayer
      .selectAll('text.group-label')
      .data(groups)
      .join('text')
      .attr('class', 'group-label')
      .attr('x', d => d.x + 25)
      .attr('y', d => d.y + 25 - d.r - 5)
      .attr('text-anchor', 'middle')
      .style('font-size', d => {
        if (d.data.id === 'private-network') return '16px';    // Largest for private network
        if (d.data.id.startsWith('cluster')) return '14px';   // Medium for clusters
        return '12px';                                         // Smallest for apps
      })
      .style('fill', '#666')
      .text(d => d.data.data?.label || d.data.id);
  }
  
  /**
   * Render node circles
   */
  renderNodes(packedRoot) {
    const nodes = packedRoot.descendants()
      .filter(d => !d.data.isGroup && !d.data.isVirtual);
    
    const nodeCircles = this.nodeLayer
      .selectAll('circle.node')
      .data(nodes, d => d.data.id)
      .join('circle')
      .attr('class', 'node')
      .attr('id', d => `node-${d.data.id}`)
      .attr('cx', d => d.x + 25)
      .attr('cy', d => d.y + 25)
      .attr('r', this.options.nodeRadius)
      .attr('fill', d => d.data.data?.fill || '#C6E5FF')  // G6 default node color
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'grab');
    
    // Node labels (optional, can be commented out for cleaner look)
    this.nodeLayer
      .selectAll('text.node-label')
      .data(nodes, d => d.data.id)
      .join('text')
      .attr('class', 'node-label')
      .attr('id', d => `node-label-${d.data.id}`)
      .attr('x', d => d.x + 25)
      .attr('y', d => d.y + 25 + 4)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#fff')
      .style('pointer-events', 'none')
      .text(d => d.data.data?.label || d.data.id);
    
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
    
    nodeCircles.call(dragBehavior);
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
    
    this.edgeLayer
      .selectAll('line.edge')
      .data(visibleEdges)
      .join('line')
      .attr('class', 'edge')
      .attr('x1', d => positionMap.get(d.source).x)
      .attr('y1', d => positionMap.get(d.source).y)
      .attr('x2', d => positionMap.get(d.target).x)
      .attr('y2', d => positionMap.get(d.target).y)
      .attr('stroke', '#999')  // G6 default edge color
      .attr('stroke-width', 1)
      .attr('opacity', 0.6);
      
    // Add arrowheads (simple triangles) to match G6 style
    this.edgeLayer
      .selectAll('polygon.arrow')
      .data(visibleEdges)
      .join('polygon')
      .attr('class', 'arrow')
      .attr('points', '0,-3 8,0 0,3')
      .attr('fill', '#999')
      .attr('opacity', 0.6)
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
    
    // Move the node visually
    d3.select(`#node-${nodeId}`)
      .attr('cx', event.x)
      .attr('cy', event.y);
    
    // Move the node label
    d3.select(`#node-label-${nodeId}`)
      .attr('x', event.x)
      .attr('y', event.y + 4);
    
    // Update connected edges
    this.updateConnectedEdges(nodeId);
  }
  
  onDragEnd(event, d) {
    // Reset cursor
    d3.select(event.sourceEvent.target).style('cursor', 'grab');
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
    this.svg.transition().duration(500).call(
      this.zoom.transform,
      d3.zoomIdentity
    );
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
  }
}