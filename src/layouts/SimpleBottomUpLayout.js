import { RandomLayout, ConcentricLayout, ForceAtlas2Layout } from '@antv/layout';
import { Graph as GraphCore } from '@antv/graphlib';
import { BaseLayout } from '@antv/g6';
import { getCombinedBBox, getExpandedBBox, getBBoxWidth, getBBoxHeight } from '@antv/g6/lib/utils/bbox';
import { AABB } from '@antv/g';

export class SimpleBottomUpLayout extends BaseLayout {
  constructor(context, options = {}) {
    super(context, options);
    
    this.id = 'simple-bottom-up';
    this.options = {
      center: [0, 0],
      treeKey: 'combo',
      spacing: 0,
      comboPadding: 0,
      preLayout: true,  // Signal to G6 that this layout needs combo preprocessing
      ...options
    };
  }

  async execute(model, options) {
    const mergedOptions = { ...this.options, ...options };
    // TODO: un-hard-code this
    const { treeKey, spacing, comboPadding } = mergedOptions;

    console.log('=== Starting Simple Bottom-Up Layout ===');
    
    // Use the real G6 graph model directly - it already has the tree structure!
    const graph = this.context.model.model;
    console.log('Using real G6 graph model with hierarchy');
    
    // Create sets for quick combo/node lookups from the model data
    const comboIds = new Set((model.combos || []).map(c => c.id));
    
    if (graph.hasTreeStructure(treeKey)) {
      console.log('Real hierarchy roots:', graph.getRoots(treeKey).map(r => r.id));
    }
    
    // Get root elements
    const roots = graph.getRoots(treeKey);
    const rootCombos = roots.filter(r => comboIds.has(r.id));
    const rootNodes = roots.filter(r => !comboIds.has(r.id));
    
    console.log(`Found ${rootCombos.length} root combos and ${rootNodes.length} root nodes`);
    
    // 1. Recursively layout each root combo's subtree FIRST (bottom-up)
    for (const rootCombo of rootCombos) {
      await this.layoutSubtree(graph, rootCombo, treeKey, comboIds);
    }
    
    // 2. Now position root level elements (they have sizes now)
    await this.positionRootElements(roots, comboIds);
    
    // 3. Update all descendant positions based on root positions
    for (const rootCombo of rootCombos) {
      this.updateDescendantPositions(graph, rootCombo, treeKey, comboIds);
    }
    
    console.log('=== Layout Complete ===');
    
    // Convert back to G6 format
    const result = this.convertToG6Data(graph, comboIds);
    return result;
  }

  /**
   * Recursively layout a subtree starting from a combo (bottom-up)
   */
  async layoutSubtree(graph, combo, treeKey, comboIds) {
    const children = graph.getChildren(combo.id, treeKey) || [];
    
    if (children.length === 0) {
      return;
    }
    
    console.log(`📦 Layout combo ${combo.id} with ${children.length} children`);
    
    // Separate child combos from child nodes
    const childCombos = children.filter(c => comboIds.has(c.id));
    
    // 1. First, recursively layout all child combos (bottom-up)
    for (const childCombo of childCombos) {
      await this.layoutSubtree(graph, childCombo, treeKey, comboIds);
    }
    
    // 2. Position all children within this combo (relative to 0,0)
    await this._actualComboLayout(children);
    
    // 3. Calculate this combo's size based on positioned children
    const newSize = this.calculateComboSize(children, comboIds);
    combo.data.size = newSize;
    
    console.log(`  Combo ${combo.id} sized to [${newSize[0].toFixed(1)}, ${newSize[1].toFixed(1)}]`);
  }

  /**
   * Update positions of all descendants based on parent position
   */
  updateDescendantPositions(graph, combo, treeKey, comboIds) {
    const children = graph.getChildren(combo.id, treeKey) || [];
    const comboX = combo.data.x || 0;
    const comboY = combo.data.y || 0;
    
    children.forEach(child => {
      // Update child position relative to parent
      child.data.x = (child.data.x || 0) + comboX;
      child.data.y = (child.data.y || 0) + comboY;
      
      // Recursively update descendants if it's a combo
      if (comboIds.has(child.id)) {
        this.updateDescendantPositions(graph, child, treeKey, comboIds);
      }
    });
  }

  /**
   * Position children within a parent combo
   */
  async _actualComboLayout(children) {
    if (children.length === 0) return;
    
    // Multiple children: use ConcentricLayout centered at origin
    const layoutGraph = new GraphCore({ nodes: children, edges: [] });

    // TODO  pass in custom options (node size, node spacing, etc)
    const tempLayout = new ConcentricLayout({
      preventOverlap: true,
      center: [0, 0],  // Layout at origin
    });
    
    await tempLayout.assign(layoutGraph, {});
    
    // Copy positions from temporary layout back to actual graph node
    children.forEach(child => {
      const layoutNode = layoutGraph.getNode(child.id);
      child.data.x = layoutNode.data.x;
      child.data.y = layoutNode.data.y;
      console.log(`    Child ${child.id} positioned at (${child.data.x.toFixed(1)}, ${child.data.y.toFixed(1)})`);
    });
  }

  /**
   * Position root level elements (combos and orphan nodes)
   */
  async positionRootElements(elements, comboIds) {
    if (elements.length === 0) return;

    console.log('📍 Using D3ForceLayout for root elements');
    
    // Create layout nodes with proper sizing
    const layoutNodes = elements.map(element => ({
      id: element.id,
      data: { 
        ...element.data,
        size: comboIds.has(element.id) ? element.data.size : undefined
      }
    }));
    
    
    const layoutGraph = new GraphCore({ nodes: layoutNodes, edges: [] });

    const layout = new ForceAtlas2Layout({
      center: [0, 0],
      preventOverlap: true,
      maxIteration: 100, // Ensure it actually runs iterations
      kr: 50, // Repulsive force constant - higher = stronger repulsion
      kg: 0,  // Gravity force constant - lower = less attraction to center
      ks: 0.1, // Speed constant
      dissuadeHubs: false, // Don't give hubs extra space
      barnesHut: true // Use Barnes-Hut optimization for better performance
    });

    const nodeSize = (node) => {
      const isCombo = comboIds.has(node.id);
      if (isCombo && node.data.size) {
        const size = Array.isArray(node.data.size) ? Math.max(...node.data.size) : node.data.size;
        const radius = size / 2;
        console.log(`  nodeSize for combo ${node.id}: diameter=${size}, radius=${radius}`);
        return radius; // ForceAtlas2 expects radius, not diameter
      }
      // For non-combos, use default node size
      console.log(`  nodeSize for node ${node.id}: radius=25 (default)`);
      return 25; // Default node radius
    };

    const result = await layout.execute(layoutGraph, { nodeSize });


    // Copy positions back to original elements from the result
    elements.forEach(element => {
      const resultNode = result.nodes.find(n => n.id === element.id);
      if (resultNode) {
        element.data.x = resultNode.data.x;
        element.data.y = resultNode.data.y;
        console.log(`  Root ${element.id} positioned at (${element.data.x.toFixed(1)}, ${element.data.y.toFixed(1)})`);
      } else {
        console.log(`  WARNING: No result node found for ${element.id}`);
      }
    });
  }


  /**
   * Calculate combo size based on its children's positions
   */
  calculateComboSize(children, comboIds) {
    if (children.length === 0) {
      return [80, 80]; // Default size for empty combos
    }

    // Create bounding boxes for all children (they're positioned relative to 0,0)
    const childrenBBoxes = children.map(child => {
      const x = child.data.x || 0;
      const y = child.data.y || 0;
      
      let width, height;
      if (comboIds.has(child.id) && child.data.size) {
        const size = child.data.size;
        width = Array.isArray(size) ? size[0] : size;
        height = Array.isArray(size) ? size[1] : size;
      } else if (comboIds.has(child.id)) {
        width = height = 80; // Default combo size
      } else {
        width = height = 50; // Default node size
      }
      
      const bbox = new AABB();
      bbox.setMinMax(
        [x - width / 2, y - height / 2, 0],
        [x + width / 2, y + height / 2, 0]
      );
      return bbox;
    });

    const combinedBBox = getCombinedBBox(childrenBBoxes);
    const padding = [0, 0, 0, 0];
    const expandedBBox = getExpandedBBox(combinedBBox, padding);
    
    const width = getBBoxWidth(expandedBBox);
    const height = getBBoxHeight(expandedBBox);
    
    // CircleCombo circumscription formula with buffer
    const circleRadius = Math.sqrt(width * width + height * height) / 2 * 1.1;
    const circleDiameter = circleRadius * 2;
    
    return [circleDiameter, circleDiameter];
  }

  /**
   * Convert graph data back to G6 format
   */
  convertToG6Data(graph, comboIds) {
    const allNodes = graph.getAllNodes();
    
    return {
      nodes: allNodes.filter(n => !comboIds.has(n.id)).map(n => ({
        id: n.id,
        style: {
          x: n.data.x,
          y: n.data.y,
          z: n.data.z || 0
        }
      })),
      edges: [], // Edges remain unchanged
      combos: allNodes.filter(n => comboIds.has(n.id)).map(n => ({
        id: n.id,
        style: {
          x: n.data.x,
          y: n.data.y,
          z: n.data.z || 0
        }
      }))
    };
  }
}