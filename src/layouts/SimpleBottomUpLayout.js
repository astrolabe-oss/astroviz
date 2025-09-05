import { ForceAtlas2Layout } from '@antv/layout';
import { Graph as GraphCore } from '@antv/graphlib';
import { BaseLayout } from '@antv/g6';
import { packSiblings, packEnclose } from 'd3';

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
      await this._layoutCombo(graph, rootCombo, treeKey, comboIds);
    }

    // 2. Now position root level elements (they have sizes now)
    await this.positionRootElements(roots, comboIds, graph, treeKey);

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
  async _layoutCombo(graph, combo, treeKey, comboIds) {
    const children = graph.getChildren(combo.id, treeKey) || [];

    if (children.length === 0) {
      return;
    }

    console.log(`📦 Layout combo ${combo.id} with ${children.length} children`);

    // Separate child combos from child nodes
    const childCombos = children.filter(c => comboIds.has(c.id));

    // 1. First, recursively layout all child combos (bottom-up)
    for (const childCombo of childCombos) {
      await this._layoutCombo(graph, childCombo, treeKey, comboIds);
    }

    // Check if all children are combos
    const allCombos = children.every(child => comboIds.has(child.id));
    if (allCombos) {
        this._circlePackingForCombos(children);
    } else {
        await this._forceLayoutForLeafNodes(children);
    }


    // 3. Calculate this combo's size based on positioned children
    console.log(`  📏 About to calculate size for combo ${combo.id}`);
    const newSize = this.calculateComboSize(children, comboIds);
    combo.data.size = newSize;
    console.log(`  Combo ${combo.id} sized to ${newSize.toFixed(1)}`);
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
  async _forceLayoutForLeafNodes(children) {
    if (children.length === 0) return;
    // Use ForceAtlas2Layout for leaf nodes - with tighter packing
    const layoutGraph = new GraphCore({ nodes: children, edges: [] });
    const tempLayout = new ForceAtlas2Layout({
        center: [0, 0],  // Layout at origin
        preventOverlap: true,
        nodeSize: 20,  // Smaller node size for tighter packing
        kr: 5,  // Much lower repulsion for tighter clustering
        kg: 10,  // Higher gravity to pull nodes together
        ks: 0.1  // Lower speed
    });

    const result = await tempLayout.execute(layoutGraph);

    // Copy positions from result back to actual graph nodes
    children.forEach(child => {
        const resultNode = result.nodes.find(n => n.id === child.id);
        if (resultNode) {
            child.data.x = resultNode.data.x;
            child.data.y = resultNode.data.y;
            console.log(`    Child ${child.id} positioned at (${child.data.x.toFixed(1)}, ${child.data.y.toFixed(1)})`);
        }
    });
  }

  /**
   * Pack circles using D3's mathematically correct circle packing
   */
  _circlePackingForCombos(children) {
    if (children.length === 0) return;

    console.log(`🎯 D3 Packing ${children.length} circles. Sizes:`, children.map(c => `${c.id}: ${c.data.size}`));

    // Prepare circles with radius for D3's packSiblings
    const circles = children.map(child => {
      const diameter = child.data.size;
      const radius = diameter / 2;

      console.log(`    Child ${child.id}: diameter=${diameter.toFixed(1)}, radius=${radius.toFixed(1)}`);

      return {
        id: child.id,
        r: radius // packSiblings expects 'r' property
      };
    });

    // Use D3's packSiblings to get optimal packing
    // This returns the circles with x,y positions centered at (0,0)
    const packedCircles = packSiblings(circles);

    console.log(`    Packed circles:`, packedCircles.map(c => 
      `${c.id}: x=${c.x.toFixed(1)}, y=${c.y.toFixed(1)}, r=${c.r.toFixed(1)}`
    ));

    // Optional: Get the enclosing circle to understand the packed size
    const enclosingCircle = packEnclose(packedCircles);
    console.log(`    Enclosing circle: x=${enclosingCircle.x.toFixed(1)}, y=${enclosingCircle.y.toFixed(1)}, r=${enclosingCircle.r.toFixed(1)}`);

    // Apply positions back to children (already centered at 0,0)
    packedCircles.forEach((circle, i) => {
      if (i < children.length) {
        children[i].data.x = circle.x;
        children[i].data.y = circle.y;
        console.log(`    Combo ${children[i].id} positioned at (${children[i].data.x.toFixed(1)}, ${children[i].data.y.toFixed(1)})`);
      }
    });
  }

  /**
   * Position root level elements (combos and orphan nodes)
   */
  async positionRootElements(elements, comboIds, graph, treeKey) {
    if (elements.length === 0) return;

    console.log('📍 Using custom concentric positioning for root elements');

    // Separate combos and non-combo nodes (public IPs)
    const combos = elements.filter(e => comboIds.has(e.id));
    const publicNodes = elements.filter(e => !comboIds.has(e.id));

    // Position combos at center initially
    combos.forEach(combo => {
      combo.data.x = 0;
      combo.data.y = 0;
      console.log(`  Combo ${combo.id} positioned at center (0, 0)`);
    });

    // Position public nodes in a tight ring around the combo
    if (publicNodes.length > 0 && combos.length > 0) {
      const mainCombo = combos[0];

      // Calculate the actual center of the combo based on its children
      const children = graph.getChildren(mainCombo.id, treeKey) || [];
      let centerX = 0;
      let centerY = 0;

      if (children.length > 0) {
        // Calculate the center of mass of all children
        children.forEach(child => {
          centerX += child.data.x || 0;
          centerY += child.data.y || 0;
        });
        centerX /= children.length;
        centerY /= children.length;
        console.log(`  Combo ${mainCombo.id} actual center: (${centerX.toFixed(1)}, ${centerY.toFixed(1)})`);
      }

      const maxComboRadius = Math.max(...combos.map(c => {
        const size = c.data.size || 100;
        return size / 2;
      }));

      // Add minimal spacing for the ring
      const ringRadius = maxComboRadius + 50; // Just 50 units padding from combo edge

      // Calculate angle step for even distribution
      const angleStep = (2 * Math.PI) / publicNodes.length;

      // Position each public node around the combo's actual center
      publicNodes.forEach((node, index) => {
        const angle = index * angleStep;
        node.data.x = centerX + ringRadius * Math.cos(angle);
        node.data.y = centerY + ringRadius * Math.sin(angle);
        console.log(`  Public node ${node.id} positioned at (${node.data.x.toFixed(1)}, ${node.data.y.toFixed(1)}) around center (${centerX.toFixed(1)}, ${centerY.toFixed(1)})`);
      });
    } else if (publicNodes.length > 0) {
      // No combos, use ForceAtlas2 for public nodes only
      const layoutGraph = new GraphCore({ nodes: publicNodes, edges: [] });
      const layout = new ForceAtlas2Layout({
        center: [0, 0],
        preventOverlap: true
      });

      const result = await layout.execute(layoutGraph);

      publicNodes.forEach(node => {
        const resultNode = result.nodes.find(n => n.id === node.id);
        if (resultNode) {
          node.data.x = resultNode.data.x;
          node.data.y = resultNode.data.y;
        }
      });
    }
  }


  /**
   * Calculate combo size based on its children's positions
   */
  calculateComboSize(children, comboIds) {
    if (children.length === 0) {
      return 80; // Default diameter for empty combos
    }

    console.log(`🔍 === CALCULATING COMBO SIZE ===`);
    console.log(`    Calculating size for combo with ${children.length} children`);
    console.log(`    Children positions:`, children.map(c => `${c.id}: (${(c.data.x || 0).toFixed(1)}, ${(c.data.y || 0).toFixed(1)})`));
    
    // Check if all children are combos or all are leaf nodes
    const allCombos = children.every(child => comboIds.has(child.id));
    const allLeaves = children.every(child => !comboIds.has(child.id));
    
    console.log(`    Children types: allCombos=${allCombos}, allLeaves=${allLeaves}`);

    // Convert children to circles for D3's packEnclose
    const circles = children.map(child => {
      const x = child.data.x || 0;
      const y = child.data.y || 0;
      
      let radius;
      if (comboIds.has(child.id) && child.data.size) {
        const diameter = child.data.size;
        radius = diameter / 2;
      } else if (comboIds.has(child.id)) {
        radius = 20; // Default combo radius
      } else {
        // Leaf nodes - use smaller radius for tighter bounds
        radius = 15; // 30 diameter = 15 radius
      }
      
      console.log(`    Child ${child.id} at (${x.toFixed(1)}, ${y.toFixed(1)}) with radius ${radius.toFixed(1)} (isCombo: ${comboIds.has(child.id)})`);
      
      return { x, y, r: radius };
    });

    // Use D3's packEnclose to get the exact minimum enclosing circle
    const enclosingCircle = packEnclose(circles);
    
    console.log(`    D3 packEnclose result: x=${enclosingCircle.x.toFixed(1)}, y=${enclosingCircle.y.toFixed(1)}, r=${enclosingCircle.r.toFixed(1)}`);
    
    // Add small buffer based on content type
    let bufferMultiplier;
    if (allLeaves) {
      bufferMultiplier = 1.02; // Just 2% buffer for leaf nodes
    } else if (allCombos) {
      bufferMultiplier = 1.1; // 10% buffer for combo children
    } else {
      bufferMultiplier = 1.05; // 5% buffer for mixed content
    }
    
    const finalRadius = enclosingCircle.r * bufferMultiplier;
    const circleDiameter = finalRadius * 2;
    
    console.log(`    Final radius=${finalRadius.toFixed(1)}, diameter=${circleDiameter.toFixed(1)} (buffer: ${(bufferMultiplier * 100 - 100).toFixed(0)}%)`);
    
    return circleDiameter; // Return just the diameter, not an array
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
          size: n.data.size
        }
      }))
    };
  }
}