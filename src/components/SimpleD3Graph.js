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
    
    // Main group
    this.g = this.svg.append('g');
    
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
    
    // Render everything
    this.renderGroups(packedRoot);
    this.renderNodes(packedRoot);
    this.renderEdges(packedRoot);
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
    
    this.nodeLayer
      .selectAll('circle.node')
      .data(nodes)
      .join('circle')
      .attr('class', 'node')
      .attr('cx', d => d.x + 25)
      .attr('cy', d => d.y + 25)
      .attr('r', this.options.nodeRadius)
      .attr('fill', d => d.data.data?.fill || '#C6E5FF')  // G6 default node color
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);
    
    // Node labels (optional, can be commented out for cleaner look)
    this.nodeLayer
      .selectAll('text.node-label')
      .data(nodes)
      .join('text')
      .attr('class', 'node-label')
      .attr('x', d => d.x + 25)
      .attr('y', d => d.y + 25 + 4)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#fff')
      .style('pointer-events', 'none')
      .text(d => d.data.data?.label || d.data.id);
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
   * Cleanup
   */
  destroy() {
    d3.select(this.container).selectAll('*').remove();
  }
}