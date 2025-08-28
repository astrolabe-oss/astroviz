import { RandomLayout, ConcentricLayout } from '@antv/layout';
import { Graph as GraphCore } from '@antv/graphlib';

export class SimpleBottomUpLayout {
  constructor(options = {}) {
    this.id = 'simple-bottom-up';
    this.preLayout = true;  // Signal to G6 that this layout needs combo preprocessing (sets _isCombo flag, IMPORTANT!)
    this.options = {
      center: [0, 0],
      treeKey: 'combo',
      spacing: 50,
      comboPadding: 20,
      ...options
    };
  }

  async execute(graph, options) {
    return this.assign(graph, options);
  }

  async assign(graph, options) {
    const mergedOptions = { ...this.options, ...options };
    const { treeKey, spacing, comboPadding } = mergedOptions;

    console.log('=== Starting Simple Bottom-Up Layout ===');

    // 1. Build levels from bottom to top
    const levels = this.buildLevelsBottomUp(graph, treeKey);
    console.log('Built levels:', levels.map(level => ({
      depth: level.depth,
      elements: level.elements.map(e => `${e.id}${e.data._isCombo ? '(combo)' : '(node)'}`)
    })));

    // 2. Process each level from deepest to shallowest
    for (const level of levels) {
      console.log(`\n--- Processing Level ${level.depth} ---`);
      console.log('Elements at this level:', level.elements.map(e => `${e.id}${e.data._isCombo ? '(combo)' : '(node)'}`));

      // Position all elements at this level using random layout
      await this.positionElementsAtLevel(level.elements, spacing);

      // Cascade positions down to descendants (only for combos)
      level.elements.forEach(element => {
        if (element.data._isCombo) {
          const offset = { x: element.data.x || 0, y: element.data.y || 0 };
          console.log(`Cascading ${element.id} position (${offset.x}, ${offset.y}) to descendants`);
          this.cascadePositionToDescendants(graph, element.id, offset, treeKey);
        }
      });
    }

    console.log('=== Layout Complete ===');
    return { nodes: graph.getAllNodes(), edges: graph.getAllEdges() };
  }

  buildLevelsBottomUp(graph, treeKey) {
    const levels = new Map(); // depth -> { depth, elements: [] }
    const allNodes = graph.getAllNodes();

    console.log('DEBUG: Sample node structure:', JSON.stringify(allNodes[0], null, 2));
    console.log('DEBUG: Does graph have getChildren?', typeof graph.getChildren);

    // Calculate depth for each node (combo or leaf)
    allNodes.forEach(node => {
      let depth;

      if (node.data._isCombo) {
        // For combos, calculate based on child hierarchy
        depth = this.calculateComboDepth(graph, node.id, treeKey);
        console.log(`DEBUG: Combo ${node.id} calculated depth: ${depth}`);
      } else {
        // For leaf nodes, determine level based on parent combo
        depth = this.calculateLeafNodeDepth(graph, node, treeKey);
        console.log(`DEBUG: Node ${node.id} (parentId: ${node.data.parentId}) calculated depth: ${depth}`);
      }

      if (!levels.has(depth)) {
        levels.set(depth, { depth, elements: [] });
      }
      levels.get(depth).elements.push(node);
    });

    // Return levels sorted bottom-up (deepest level first, root level last)
    return Array.from(levels.values()).sort((a, b) => b.depth - a.depth);
  }

  calculateComboDepth(graph, comboId, treeKey, depthCache = new Map()) {
    // Use cache to avoid recalculating
    if (depthCache.has(comboId)) {
      return depthCache.get(comboId);
    }

    // Get all children of this combo
    const children = graph.getChildren(comboId, treeKey) || [];
    const childCombos = children.filter(child => child.data._isCombo);
    
    console.log(`DEBUG calculateComboDepth: ${comboId} has ${children.length} children (${childCombos.length} combos)`);

    if (childCombos.length === 0) {
      // This combo has no child combos, so it's at the deepest level for combos
      // But we need to check if it has regular nodes as children
      const childNodes = children.filter(child => !child.data._isCombo);
      const depth = childNodes.length > 0 ? 2 : 0; // If has nodes, depth 2; if empty, depth 0
      console.log(`DEBUG: ${comboId} is leaf combo with ${childNodes.length} nodes -> depth ${depth}`);
      depthCache.set(comboId, depth);
      return depth;
    }

    // This combo has child combos, so its depth is max child depth + 1
    let maxChildDepth = -1;
    for (const childCombo of childCombos) {
      const childDepth = this.calculateComboDepth(graph, childCombo.id, treeKey, depthCache);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }
    
    const depth = maxChildDepth + 1;
    console.log(`DEBUG: ${comboId} has max child depth ${maxChildDepth} -> depth ${depth}`);
    depthCache.set(comboId, depth);
    return depth;
  }

  calculateLeafNodeDepth(graph, node, treeKey) {
    // Find which combo has this node as a child by checking all combos
    const allCombos = graph.getAllNodes().filter(n => n.data._isCombo);
    
    for (const combo of allCombos) {
      const children = graph.getChildren(combo.id, treeKey) || [];
      if (children.some(child => child.id === node.id)) {
        // Found the parent combo, leaf nodes are one level deeper than their parent combo
        const parentDepth = this.calculateComboDepth(graph, combo.id, treeKey);
        console.log(`DEBUG: Node ${node.id} found in combo ${combo.id} (depth ${parentDepth}) -> node depth ${parentDepth + 1}`);
        return parentDepth + 1;
      }
    }

    // No parent combo found, this is a root node
    console.log(`DEBUG: Node ${node.id} has no parent combo -> root depth 0`);
    return 0;
  }

  async positionElementsAtLevel(elements, spacing) {
    if (elements.length === 0) return;

    // Create a simple graph with all elements at this level
    const layoutNodes = elements.map(element => ({
      id: element.id,
      data: { ...element.data }
    }));

    const layoutGraph = new GraphCore({ nodes: layoutNodes, edges: [] });

    // // Use random layout to position them
    // const layout = new RandomLayout({
    //   center: [0, 0],
    //   width: 600,
    //   height: 400
    // });


    const layout = new ConcentricLayout({
      preventOverlap: true,
      center: [0, 0],
      width: 600,
      height: 400,
      nodeSize: (node) => {
        console.log(`nodeSize called for: ${node.id}, _isCombo: ${!!node.data._isCombo}`);
        
        // If it's a combo, use its size data or a larger default
        if (node.data._isCombo) {
          // Check if combo already has size calculated (from child layout)
          if (node.data.size) {
            const size = node.data.size;
            const calculatedSize = Array.isArray(size) ? Math.max(size[0], size[1]) : size;
            console.log(`  Combo ${node.id} has existing size data:`, size, `-> using size: ${calculatedSize}`);
            return calculatedSize;
          }
          // Default size for combos
          console.log(`  Combo ${node.id} has no size data -> using default size: 100`);
          return 100;
        }
        // Default size for regular nodes
        console.log(`  Node ${node.id} -> using default size: 30`);
        return 30;
      }
    });


    console.log(`Positioning ${elements.length} elements (combos + nodes) with concentric layout`);
    await layout.assign(layoutGraph, {});

    // Copy positions back to original elements
    elements.forEach(element => {
      const layoutNode = layoutGraph.getNode(element.id);
      element.data.x = layoutNode.data.x;
      element.data.y = layoutNode.data.y;
      console.log(`  ${element.id}: positioned at (${element.data.x}, ${element.data.y})`);
    });
  }


  cascadePositionToDescendants(graph, comboId, offset, treeKey) {
    const children = graph.getChildren(comboId, treeKey);

    if (!children) return;

    children.forEach(child => {
      // Adjust this child's position by the offset
      child.data.x = (child.data.x || 0) + offset.x;
      child.data.y = (child.data.y || 0) + offset.y;

      console.log(`  Adjusted ${child.id}: (${child.data.x}, ${child.data.y})`);

      // Recursively adjust its descendants if it's a combo
      if (child.data._isCombo) {
        this.cascadePositionToDescendants(graph, child.id, offset, treeKey);
      }
    });
  }
}