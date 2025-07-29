import { RandomLayout, ConcentricLayout } from '@antv/layout';
import { Graph as GraphCore } from '@antv/graphlib';

export class SimpleBottomUpLayout {
  constructor(options = {}) {
    this.id = 'simple-bottom-up';
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

    // Calculate depth for each node (combo or leaf)
    allNodes.forEach(node => {
      let depth;

      if (node.data._isCombo) {
        // For combos, calculate based on child hierarchy
        depth = this.calculateComboDepth(graph, node.id, treeKey);
      } else {
        // For leaf nodes, determine level based on parent combo
        depth = this.calculateLeafNodeDepth(graph, node, treeKey);
      }

      if (!levels.has(depth)) {
        levels.set(depth, { depth, elements: [] });
      }
      levels.get(depth).elements.push(node);
    });

    // Return levels sorted bottom-up (deepest level first, root level last)
    return Array.from(levels.values()).sort((a, b) => b.depth - a.depth);
  }

  calculateComboDepth(graph, comboId, treeKey, visited = new Set()) {
    if (visited.has(comboId)) return 0; // Avoid cycles
    visited.add(comboId);

    // Find parent combo to determine depth from root
    const parentCombo = graph.getAllNodes().find(n => 
      n.data._isCombo && 
      graph.getChildren(n.id, treeKey)?.some(child => child.id === comboId)
    );

    if (!parentCombo) {
      return 0; // Root combo = depth 0
    }

    // Depth is parent depth + 1
    return this.calculateComboDepth(graph, parentCombo.id, treeKey, visited) + 1;
  }

  calculateLeafNodeDepth(graph, node, treeKey) {
    // If the node has no parent combo, it's a root node (depth 0)
    if (!node.combo) {
      return 0;
    }

    // Find the parent combo and calculate its depth
    const parentCombo = graph.getAllNodes().find(n => n.id === node.combo && n.data._isCombo);
    if (!parentCombo) {
      return 0; // Parent combo not found, treat as root
    }

    // Leaf nodes are one level deeper than their parent combo
    return this.calculateComboDepth(graph, parentCombo.id, treeKey) + 1;
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
        // If it's a combo, use its size data or a larger default
        if (node.data._isCombo) {
          // Check if combo already has size calculated (from child layout)
          if (node.data.size) {
            const size = node.data.size;
            return Array.isArray(size) ? Math.max(size[0], size[1]) : size;
          }
          // Default size for combos
          return 100;
        }
        // Default size for regular nodes
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