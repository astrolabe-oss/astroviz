import { pack, hierarchy } from 'd3';

/**
 * D3G6LayoutManager - Coordinates D3 circle packing with G6 visualization
 * Uses D3 for mathematical layout calculations and G6 for rendering
 */
export class D3G6LayoutManager {
  constructor(graph, options = {}) {
    this.graph = graph;
    this.options = {
      padding: options.padding || 5,
      containerSize: options.containerSize || [800, 600],
      enableDebug: options.enableDebug || false,
      ...options
    };
    
    this.packLayout = pack()
      .size(this.options.containerSize)
      .padding(this.options.padding);
    
    this.setupEventListeners();
  }

  /**
   * Setup G6 event listeners to trigger recalculation
   */
  setupEventListeners() {
    // After initial layout
    this.graph.on('afterlayout', () => {
      console.log('D3G6: After layout - recalculating positions');
      this.recalculatePositions();
    });
    
    // After dragging elements
    this.graph.on('node:dragend', (e) => {
      console.log('D3G6: Node drag ended:', e.target.id);
      this.recalculatePositions();
    });
    
    this.graph.on('combo:dragend', (e) => {
      console.log('D3G6: Combo drag ended:', e.target.id);
      this.recalculatePositions();
    });
    
    // After expand/collapse
    this.graph.on('combo:collapse', (e) => {
      console.log('D3G6: Combo collapsed:', e.target.id);
      setTimeout(() => this.recalculatePositions(), 100);
    });
    
    this.graph.on('combo:expand', (e) => {
      console.log('D3G6: Combo expanded:', e.target.id);
      setTimeout(() => this.recalculatePositions(), 100);
    });
  }

  /**
   * Build D3 hierarchy from G6 graph data
   */
  buildHierarchy() {
    const graphData = this.graph.getData();
    const { nodes, combos } = graphData;
    
    // Create a map for quick lookup
    const comboMap = new Map();
    const nodeMap = new Map();
    
    // First pass: create all combos
    combos?.forEach(combo => {
      comboMap.set(combo.id, {
        id: combo.id,
        parent: combo.combo,
        children: [],
        isCombo: true,
        data: combo.data
      });
    });
    
    // Second pass: set up parent-child relationships
    combos?.forEach(combo => {
      if (combo.combo && comboMap.has(combo.combo)) {
        comboMap.get(combo.combo).children.push(comboMap.get(combo.id));
      }
    });
    
    // Add nodes to their parent combos
    nodes.forEach(node => {
      const nodeData = {
        id: node.id,
        value: this.getNodeSize(node),
        isCombo: false,
        data: node.data,
        originalNode: node
      };
      
      nodeMap.set(node.id, nodeData);
      
      if (node.combo && comboMap.has(node.combo)) {
        comboMap.get(node.combo).children.push(nodeData);
      }
    });
    
    // Find root combos (those without parents)
    const roots = [];
    comboMap.forEach(combo => {
      if (!combo.parent) {
        roots.push(combo);
      }
    });
    
    // If we have multiple roots, create a virtual root
    let root;
    if (roots.length === 1) {
      root = roots[0];
    } else if (roots.length > 1) {
      root = {
        id: 'virtual-root',
        children: roots,
        isCombo: true,
        isVirtual: true
      };
    } else {
      // No combos, just pack the nodes
      root = {
        id: 'virtual-root',
        children: Array.from(nodeMap.values()),
        isCombo: true,
        isVirtual: true
      };
    }
    
    return root;
  }

  /**
   * Get the size for a node (for leaf nodes in D3 hierarchy)
   */
  getNodeSize(node) {
    // Try to get actual rendered size
    const element = this.graph.getElementRenderById(node.id);
    if (element) {
      const bbox = element.getBounds();
      if (bbox) {
        const width = bbox.max[0] - bbox.min[0];
        const height = bbox.max[1] - bbox.min[1];
        return Math.max(width, height);
      }
    }
    
    // Fallback to configured size
    if (node.data?.size) {
      return Array.isArray(node.data.size) ? 
        Math.max(...node.data.size) : node.data.size;
    }
    
    // Default size
    return 30;
  }

  /**
   * Recalculate all positions using D3 pack
   */
  recalculatePositions() {
    try {
      // Build hierarchy from current G6 data
      const hierarchyData = this.buildHierarchy();
      
      // Create D3 hierarchy
      const root = hierarchy(hierarchyData)
        .sum(d => d.value || 0)
        .sort((a, b) => (b.value || 0) - (a.value || 0));
      
      // Apply D3 pack layout
      const packedRoot = this.packLayout(root);
      
      // Apply positions back to G6
      this.applyPositions(packedRoot);
      
      if (this.options.enableDebug) {
        this.debugLog(packedRoot);
      }
      
    } catch (error) {
      console.error('D3G6: Error recalculating positions:', error);
    }
  }

  /**
   * Apply D3-calculated positions back to G6
   */
  applyPositions(packedRoot) {
    const updates = {
      nodes: [],
      combos: []
    };
    
    // Traverse the packed hierarchy
    packedRoot.each(node => {
      if (node.data.isVirtual) return; // Skip virtual root
      
      const update = {
        id: node.data.id,
        data: {
          x: node.x,
          y: node.y
        }
      };
      
      if (node.data.isCombo) {
        // For combos, also update size based on packed radius
        update.data.size = [node.r * 2, node.r * 2];
        updates.combos.push(update);
      } else {
        updates.nodes.push(update);
      }
    });
    
    // Batch update G6
    if (updates.nodes.length > 0) {
      console.log(`D3G6: Updating ${updates.nodes.length} nodes`);
      this.graph.updateNodeData(updates.nodes);
    }
    
    if (updates.combos.length > 0) {
      console.log(`D3G6: Updating ${updates.combos.length} combos`);
      this.graph.updateComboData(updates.combos);
    }
    
    // Render the updates
    this.graph.render();
  }

  /**
   * Debug logging
   */
  debugLog(packedRoot) {
    console.log('=== D3G6 Pack Results ===');
    packedRoot.each(node => {
      if (!node.data.isVirtual) {
        console.log(`${node.data.isCombo ? 'Combo' : 'Node'} ${node.data.id}:`, {
          x: node.x.toFixed(2),
          y: node.y.toFixed(2),
          r: node.r.toFixed(2),
          depth: node.depth
        });
      }
    });
  }

  /**
   * Manual trigger for recalculation
   */
  recalculate() {
    this.recalculatePositions();
  }

  /**
   * Update container size
   */
  setContainerSize(width, height) {
    this.options.containerSize = [width, height];
    this.packLayout.size([width, height]);
    this.recalculatePositions();
  }

  /**
   * Cleanup event listeners
   */
  destroy() {
    this.graph.off('afterlayout');
    this.graph.off('node:dragend');
    this.graph.off('combo:dragend');
    this.graph.off('combo:collapse');
    this.graph.off('combo:expand');
  }
}