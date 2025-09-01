import { RandomLayout, ConcentricLayout } from '@antv/layout';
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
    const { treeKey, spacing, comboPadding } = mergedOptions;

    console.log('=== Starting Simple Bottom-Up Layout ===');
    
    // Use the real G6 graph model directly - it already has the tree structure!
    const graph = this.context.model.model;
    console.log('Using real G6 graph model with hierarchy');
    
    // Create sets for quick combo/node lookups from the model data
    const comboIds = new Set((model.combos || []).map(c => c.id));
    const nodeIds = new Set((model.nodes || []).map(n => n.id));
    
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
      await this.layoutSubtree(graph, rootCombo, treeKey, spacing, comboIds);
    }
    
    // 2. Now position root level elements (they have sizes now)
    await this.positionRootElements(roots, spacing, comboIds);
    
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
  async layoutSubtree(graph, combo, treeKey, spacing, comboIds) {
    const children = graph.getChildren(combo.id, treeKey) || [];
    
    if (children.length === 0) {
      // Empty combo - set default size
      combo.data.size = [80, 80];
      return;
    }
    
    console.log(`📦 Layout combo ${combo.id} with ${children.length} children`);
    
    // Separate child combos from child nodes
    const childCombos = children.filter(c => comboIds.has(c.id));
    
    // 1. First, recursively layout all child combos (bottom-up)
    for (const childCombo of childCombos) {
      await this.layoutSubtree(graph, childCombo, treeKey, spacing, comboIds);
    }
    
    // 2. Position all children within this combo (relative to 0,0)
    await this.positionChildrenInCombo(combo, children, spacing, comboIds);
    
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
  async positionChildrenInCombo(parentCombo, children, spacing, comboIds) {
    if (children.length === 0) return;
    
    if (children.length === 1) {
      // Single child: place at origin
      children[0].data.x = 0;
      children[0].data.y = 0;
      console.log(`  Single child ${children[0].id} at center`);
      return;
    }
    
    // Multiple children: use ConcentricLayout centered at origin
    const layoutNodes = children.map(child => ({
      id: child.id,
      data: { 
        ...child.data,
        // Pass size if it's a combo that has been sized
        size: comboIds.has(child.id) ? child.data.size : undefined
      }
    }));
    
    const layoutGraph = new GraphCore({ nodes: layoutNodes, edges: [] });
    
    // Estimate layout area
    const baseSize = 80;
    const nodeSpacing = 60;
    const minSize = 120;
    const estimatedSize = Math.max(minSize, 
      (children.length * baseSize) + ((children.length - 1) * nodeSpacing));
    
    const layout = new ConcentricLayout({
      preventOverlap: true,
      center: [0, 0],  // Layout at origin
      width: estimatedSize,
      height: estimatedSize,
      nodeSpacing: 20,
      nodeSize: (node) => {
        const isCombo = comboIds.has(node.id);
        if (isCombo && node.data.size) {
          const size = Array.isArray(node.data.size) ? Math.max(...node.data.size) : node.data.size;
          return size / 2;
        }
        return isCombo ? 40 : 15;
      }
    });
    
    await layout.assign(layoutGraph, {});
    
    // Copy positions back to original elements
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
  async positionRootElements(elements, spacing, comboIds) {
    if (elements.length === 0) return;
      const rootCombos = elements.filter(el => comboIds.has(el.id));
      const orphanNodes = elements.filter(el => !comboIds.has(el.id));

      if (rootCombos.length === 0) return;

      // Find the largest combo as central element
      const centralCombo = rootCombos.reduce((largest, combo) => {
          const comboSize = combo.data.size ?
              (Array.isArray(combo.data.size) ? Math.max(...combo.data.size) : combo.data.size) : 80;
          const largestSize = largest.data.size ?
              (Array.isArray(largest.data.size) ? Math.max(...largest.data.size) : largest.data.size) : 80;
          return comboSize > largestSize ? combo : largest;
      }, rootCombos[0]);

      // Position central combo at center
      centralCombo.data.x = 0;
      centralCombo.data.y = 0;
      console.log(`  Central combo ${centralCombo.id} at (0, 0)`);

      // Position other root combos in circle
      const otherCombos = rootCombos.filter(combo => combo.id !== centralCombo.id);
      if (otherCombos.length > 0) {
          const comboAngleStep = (2 * Math.PI) / otherCombos.length;
          const comboDistance = 200;

          otherCombos.forEach((combo, index) => {
              const angle = index * comboAngleStep;
              combo.data.x = comboDistance * Math.cos(angle);
              combo.data.y = comboDistance * Math.sin(angle);
              console.log(`  Combo ${combo.id} at (${combo.data.x.toFixed(1)}, ${combo.data.y.toFixed(1)})`);
          });
      }

      // Position orphan nodes tightly around central combo
      if (orphanNodes.length > 0) {
          const comboRadius = centralCombo.data.size ?
              (Array.isArray(centralCombo.data.size) ? Math.max(...centralCombo.data.size) / 2 : centralCombo.data.size / 2) : 80;
          const nodeRadius = 25;
          const gap = 20;
          const distance = comboRadius + nodeRadius + gap;

          const angleStep = (2 * Math.PI) / orphanNodes.length;
          orphanNodes.forEach((node, index) => {
              const angle = index * angleStep - Math.PI / 2;
              node.data.x = distance * Math.cos(angle);
              node.data.y = distance * Math.sin(angle);
              console.log(`  Orphan ${node.id} at (${node.data.x.toFixed(1)}, ${node.data.y.toFixed(1)})`);
          });
      }
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