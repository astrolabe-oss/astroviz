import { ForceAtlas2Layout } from '@antv/layout';
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
        this._customCirclePackingComboLayout(children);
    } else {
        await this._forceLayoutForLeafNodes(children);
    }

    
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
  async _forceLayoutForLeafNodes(children) {
    if (children.length === 0) return;
    // Use ForceAtlas2Layout for leaf nodes - with tighter packing
    const layoutGraph = new GraphCore({ nodes: children, edges: [] });
    const tempLayout = new ForceAtlas2Layout({
        center: [0, 0],  // Layout at origin
        preventOverlap: true,
        nodeSize: 20,  // Smaller node size for tighter packing
        nodeSpacing: 5,  // Minimal spacing between nodes
        kr: 5,  // Much lower repulsion for tighter clustering
        kg: 10,  // Higher gravity to pull nodes together
        ks: 0.1,  // Lower speed
        maxIterations: 500,  // More iterations for better convergence
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
   * Pack circles tightly using a simple circle packing algorithm
   */
  _customCirclePackingComboLayout(children) {
    if (children.length === 0) return;
    
    // Sort circles by size (largest first for better packing)
    children.sort((a, b) => {
      const sizeA = a.data.size ? (Array.isArray(a.data.size) ? Math.max(...a.data.size) : a.data.size) : 100;
      const sizeB = b.data.size ? (Array.isArray(b.data.size) ? Math.max(...b.data.size) : b.data.size) : 100;
      return sizeB - sizeA;
    });
    
    // Place first circle at center
    children[0].data.x = 0;
    children[0].data.y = 0;
    console.log(`    Combo ${children[0].id} positioned at center (0.0, 0.0)`);
    
    if (children.length === 1) return;
    
    // Track placed circles
    const placed = [children[0]];
    
    // Place remaining circles
    for (let i = 1; i < children.length; i++) {
      const radius = (children[i].data.size ?
        (Array.isArray(children[i].data.size) ? Math.max(...children[i].data.size) : children[i].data.size) : 100) / 2;
      
      let bestPosition = null;
      let minDistance = Infinity;
      
      // Try to place next to each already placed circle
      for (const placedCircle of placed) {
        const placedRadius = (placedCircle.data.size ? 
          (Array.isArray(placedCircle.data.size) ? Math.max(...placedCircle.data.size) : placedCircle.data.size) : 100) / 2;
        
        // Calculate positions at various angles around the placed circle
        const numAngles = 8; // Try 8 positions around each circle
        for (let j = 0; j < numAngles; j++) {
          const angle = (j * 2 * Math.PI) / numAngles;
          const distance = placedRadius + radius + 2; // Just 2 pixels padding between circles
          const x = placedCircle.data.x + distance * Math.cos(angle);
          const y = placedCircle.data.y + distance * Math.sin(angle);
          
          // Check if this position overlaps with any placed circle
          let valid = true;
          for (const other of placed) {
            if (other === placedCircle) continue;
            const otherRadius = (other.data.size ? 
              (Array.isArray(other.data.size) ? Math.max(...other.data.size) : other.data.size) : 100) / 2;
            const dx = x - other.data.x;
            const dy = y - other.data.y;
            const centerDistance = Math.sqrt(dx * dx + dy * dy);
            if (centerDistance < radius + otherRadius + 2) { // Just 2 pixels padding for overlap check
              valid = false;
              break;
            }
          }
          
          // If valid, check if it's closer to center than current best
          if (valid) {
            const distFromCenter = Math.sqrt(x * x + y * y);
            if (distFromCenter < minDistance) {
              minDistance = distFromCenter;
              bestPosition = { x, y };
            }
          }
        }
      }
      
      // Place the circle at the best position found
      if (bestPosition) {
        children[i].data.x = bestPosition.x;
        children[i].data.y = bestPosition.y;
      } else {
        // Fallback: place in a ring if no valid position found
        const angle = (i * 2 * Math.PI) / children.length;
        const ringRadius = 200 + radius;
        children[i].data.x = ringRadius * Math.cos(angle);
        children[i].data.y = ringRadius * Math.sin(angle);
      }
      
      console.log(`    Combo ${children[i].id} positioned at (${children[i].data.x.toFixed(1)}, ${children[i].data.y.toFixed(1)})`);
      placed.push(children[i]);
    }
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
        const size = c.data.size;
        return (Array.isArray(size) ? Math.max(...size) : size) / 2;
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
      return [80, 80]; // Default size for empty combos
    }

    // Check if all children are combos or all are leaf nodes
    const allCombos = children.every(child => comboIds.has(child.id));
    const allLeaves = children.every(child => !comboIds.has(child.id));

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
        width = height = 40; // Default combo size
      } else {
        // Leaf nodes - use smaller size for tighter bounds
        width = height = 30; // Smaller than default to fit tighter
      }
      
      const bbox = new AABB();
      bbox.setMinMax(
        [x - width / 2, y - height / 2, 0],
        [x + width / 2, y + height / 2, 0]
      );
      return bbox;
    });

    const combinedBBox = getCombinedBBox(childrenBBoxes);
    const padding = [1, 1, 1, 1]; // Just 5 pixels padding on all sides
    const expandedBBox = getExpandedBBox(combinedBBox, padding);
    
    const width = getBBoxWidth(expandedBBox);
    const height = getBBoxHeight(expandedBBox);
    
    // Different sizing strategies based on content
    let circleRadius;
    if (allLeaves) {
      // For leaf nodes, use tighter fit with minimal buffer
      circleRadius = Math.sqrt(width * width + height * height) / 2 * 1.02; // Just 2% buffer
    } else if (allCombos) {
      // For combo children, use standard buffer
      circleRadius = Math.sqrt(width * width + height * height) / 2 * 1.1;
    } else {
      // Mixed content, use moderate buffer
      circleRadius = Math.sqrt(width * width + height * height) / 2 * 1.05;
    }
    
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