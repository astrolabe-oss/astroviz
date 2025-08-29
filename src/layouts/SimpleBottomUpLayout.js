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
    // Now we have access to this.context.model.model which has the real hierarchy!
    const mergedOptions = { ...this.options, ...options };
    const { treeKey, spacing, comboPadding } = mergedOptions;

    console.log('=== Starting Simple Bottom-Up Layout ===');
    
    // Access the REAL graph model with full hierarchy via context
    const realGraph = this.context.model.model;
    console.log('Using real G6 graph model with hierarchy');
    
    if (realGraph.hasTreeStructure(treeKey)) {
      console.log('Real hierarchy roots:', realGraph.getRoots(treeKey).map(r => r.id));
      
      // Verify the hierarchy is correct in the real model
      const cluster1Children = realGraph.getChildren('cluster1', treeKey);
      console.log('cluster1 children in real model:', cluster1Children ? cluster1Children.map(c => c.id) : 'none');
      
      const app1Parent = realGraph.getParent('app1', treeKey);
      console.log('app1 parent in real model:', app1Parent ? app1Parent.id : 'none');
    }
    
    // Create a working graph from the model data with hierarchy
    const workingGraph = this.createWorkingGraph(model, realGraph, treeKey);
    
    // 1. Build levels from bottom to top
    const levels = this.buildLevelsBottomUp(workingGraph, treeKey);
    console.log('Built levels:', levels.map(level => ({
      depth: level.depth,
      elements: level.elements.map(e => `${e.id}${e.data._isCombo ? '(combo)' : '(node)'}`)
    })));

    // 2. Process each level from shallowest to deepest (top-down)
    for (let currentDepth = 0; currentDepth <= Math.max(...levels.map(l => l.depth)); currentDepth++) {
      const level = levels.find(l => l.depth === currentDepth);
      if (!level || level.elements.length === 0) continue;
      // if (level.depth > 1) continue;

      console.log(`\n--- Processing Level ${level.depth} (${level.depth === 0 ? 'ROOT' : level.depth === 1 ? 'CLUSTER' : level.depth === 2 ? 'APP' : 'LEAF'}) ---`);
      console.log('Elements at this level:', level.elements.map(e => `${e.id}${e.data._isCombo ? '(combo)' : '(node)'}`));

      if (level.depth === 0) {
        // Level 0: Position root combos with default sizes using ConcentricLayout
        console.log('📍 Positioning root level combos with ConcentricLayout');
        await this.positionElementsAtLevel(level.elements, spacing);
      } else {
        // Level 1+: Position children centered within their parent combo bounds
        console.log(`📍 Positioning Level ${level.depth} elements within their parent combos`);
        await this.positionChildrenWithinParents(workingGraph, level.elements, treeKey);
      }

      // After positioning this level, cascade back and update parent sizes
      await this.cascadeParentSizing(workingGraph, currentDepth, treeKey, spacing);
      
      console.log(`✅ Completed Level ${level.depth}`);
    }

    console.log('=== Layout Complete ===');
    
    // Convert back to G6 format
    const result = this.convertToG6Data(workingGraph);
    return result;
  }

  buildLevelsBottomUp(graph, treeKey) {
    const levels = new Map(); // depth -> { depth, elements: [] }
    const allNodes = graph.getAllNodes();

    console.log('DEBUG: Sample node structure:', JSON.stringify(allNodes[0], null, 2));
    console.log('DEBUG: Does graph have getChildren?', typeof graph.getChildren);
    console.log('DEBUG: Does graph have getParent?', typeof graph.getParent);
    console.log('DEBUG: Total nodes to process:', allNodes.length);
    console.log('DEBUG: Combo nodes:', allNodes.filter(n => n.data._isCombo).map(n => n.id));

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

    // Return levels sorted top-down (shallowest level first, deepest level last)
    // Level 0 = roots, Level 1 = clusters, Level 2 = apps, Level 3 = leaf nodes
    return Array.from(levels.values()).sort((a, b) => a.depth - b.depth);
  }

  calculateComboDepth(graph, comboId, treeKey, depthCache = new Map()) {
    // Use cache to avoid recalculating
    if (depthCache.has(comboId)) {
      return depthCache.get(comboId);
    }

    // Find the parent of this combo to determine depth from root
    const parent = graph.getParent(comboId, treeKey);
    
    if (!parent) {
      // No parent means this is a root combo (depth 0)
      console.log(`DEBUG: ${comboId} is root combo -> depth 0`);
      depthCache.set(comboId, 0);
      return 0;
    }

    // This combo has a parent, so its depth is parent depth + 1
    const parentDepth = this.calculateComboDepth(graph, parent.id, treeKey, depthCache);
    const depth = parentDepth + 1;
    console.log(`DEBUG: ${comboId} has parent ${parent.id} at depth ${parentDepth} -> depth ${depth}`);
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


    // Calculate total size needed and use larger spacing for large combos
    const totalSize = elements.reduce((sum, element) => {
      if (element.data._isCombo && element.data.size) {
        const size = Array.isArray(element.data.size) ? Math.max(...element.data.size) : element.data.size;
        return sum + size;
      }
      return sum + 60; // Default for nodes
    }, 0);
    
    // Use larger layout area for combos
    const layoutWidth = Math.max(800, totalSize * 1.5);
    const layoutHeight = Math.max(600, totalSize * 1.2);
    
    console.log(`Level has ${elements.length} elements, total size: ${totalSize}, using layout area: ${layoutWidth}x${layoutHeight}`);

    // Debug: Let's try a completely different approach - use RandomLayout first to see if spacing works there
    console.log(`🔍 DEBUG: Creating layout with spacing=${spacing}, elements=${elements.length}`);
    
    const layout = new ConcentricLayout({
      preventOverlap: true,
      center: [0, 0],
      width: layoutWidth,
      height: layoutHeight,
      nodeSpacing: spacing,
      nodeSize: (node) => {
        const isCombo = !!node.data._isCombo;
        console.log(`🎯 nodeSize called for: ${node.id}, _isCombo: ${isCombo}, spacing param: ${spacing}`);
        
        // If it's a combo, use its calculated size from positioned children
        if (isCombo) {
          if (node.data.size) {
            const size = node.data.size;
            const radius = Array.isArray(size) ? Math.max(size[0], size[1]) / 2 : size / 2;
            console.log(`  📦 Combo ${node.id} size from positioned children:`, size, `-> radius: ${radius}`);
            return radius;
          }
          console.log(`  📦 Combo ${node.id} -> no size data, using default: 80`);
          return 80;  // Fallback for combos without calculated size
        }
        console.log(`  🔵 Node ${node.id} -> using default: 30`);
        return 30;
      }
    });
    
    console.log(`🔍 ConcentricLayout created with config:`, {
      preventOverlap: true,
      nodeSpacing: spacing,
      width: layoutWidth,
      height: layoutHeight
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


  calculateComboSize(graph, comboId, treeKey) {
    const children = graph.getChildren(comboId, treeKey) || [];
    
    console.log(`🔍 Calculating size for combo ${comboId} with ${children.length} children using G6's exact logic`);
    
    if (children.length === 0) {
      // Empty combo: use default size (matching G6's logic)
      console.log(`  Empty combo ${comboId} -> using default size [80, 80]`);
      return [80, 80];
    }

    // Use G6's exact logic: getCombinedBBox + getExpandedBBox
    const childrenBBoxes = children.map(child => this.createChildBBox(child));
    const combinedBBox = getCombinedBBox(childrenBBoxes);
    
    console.log(`  Combined bbox for ${comboId}:`, {
      min: combinedBBox.min,
      max: combinedBBox.max, 
      width: getBBoxWidth(combinedBBox),
      height: getBBoxHeight(combinedBBox)
    });
    
    // Apply the same padding as our combo style: [20, 20, 20, 20]
    const padding = [0,0,0,0]
    const expandedBBox = getExpandedBBox(combinedBBox, padding);
    
    const width = getBBoxWidth(expandedBBox);
    const height = getBBoxHeight(expandedBBox);
    
    // CRITICAL FIX: G6's CircleCombo uses circumscription formula: radius = sqrt(width² + height²) / 2
    // This ensures our layout collision size matches G6's visual rendering exactly
    // Add 10% buffer to prevent slight overlaps
    const circleRadius = Math.sqrt(width * width + height * height) / 2 * 1.1;
    const circleDiameter = circleRadius * 2;
    
    console.log(`  Bbox: [${width}, ${height}] -> CircleCombo radius: ${circleRadius} (diameter: ${circleDiameter})`);
    return [circleDiameter, circleDiameter];
  }

  createChildBBox(child) {
    // Create an AABB for a child element based on its position and size
    const x = child.data.x || 0;
    const y = child.data.y || 0;
    
    // Determine size based on whether it's a combo or node
    let width, height;
    if (child.data._isCombo && child.data.size) {
      // Child combo has calculated size
      const size = child.data.size;
      width = Array.isArray(size) ? size[0] : size;
      height = Array.isArray(size) ? size[1] : size;
    } else if (child.data._isCombo) {
      // Child combo without size - use default
      width = height = 80;
    } else {
      // Regular node - use G6Test.vue configured size (radius 25 -> diameter 50)
      width = height = 50;
    }
    
    const bbox = new AABB();
    bbox.setMinMax(
      [x - width / 2, y - height / 2, 0],
      [x + width / 2, y + height / 2, 0]
    );
    
    console.log(`    Child ${child.id} bbox: center(${x}, ${y}) size(${width}x${height})`);
    return bbox;
  }

  repositionDescendantsAroundCombo(graph, comboId, comboCenter, treeKey) {
    const children = graph.getChildren(comboId, treeKey);
    if (!children || children.length === 0) return;

    // Calculate the bounding box of current child positions
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    children.forEach(child => {
      const x = child.data.x || 0;
      const y = child.data.y || 0;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });

    // Calculate current children center
    const childrenCenter = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    };

    // Calculate offset to move children to combo center
    const offset = {
      x: comboCenter.x - childrenCenter.x,
      y: comboCenter.y - childrenCenter.y
    };

    // Apply offset to all children
    children.forEach(child => {
      child.data.x = (child.data.x || 0) + offset.x;
      child.data.y = (child.data.y || 0) + offset.y;
      console.log(`  Repositioned ${child.id}: (${child.data.x}, ${child.data.y})`);

      // Recursively reposition descendants if it's a combo
      if (child.data._isCombo) {
        this.repositionDescendantsAroundCombo(graph, child.id, {
          x: child.data.x,
          y: child.data.y
        }, treeKey);
      }
    });
  }

  createWorkingGraph(model, realGraph, treeKey) {
    // Create a new graph with the model data
    const { nodes = [], edges = [], combos = [] } = model;
    
    console.log('Creating working graph with nodes:', nodes.length, 'combos:', combos.length);
    
    // Map nodes (preserve as regular nodes)
    const nodeData = nodes.map(n => ({
      id: n.id,
      data: { ...n.data, ...n.style, _isCombo: false }
    }));
    
    // Map combos (mark as combos)
    const comboData = combos.map(c => ({
      id: c.id,
      data: { ...c.data, ...c.style, _isCombo: true }
    }));
    
    const workingGraph = new GraphCore({
      nodes: [...nodeData, ...comboData],
      edges: edges.map(e => ({
        id: e.id || `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        data: e.data || {}
      }))
    });
    
    // Attach tree structure and copy hierarchy from real graph
    workingGraph.attachTreeStructure(treeKey);
    
    console.log('Copying hierarchy from real graph...');
    [...nodes, ...combos].forEach(node => {
      const parent = realGraph.getParent(node.id, treeKey);
      if (parent) {
        console.log(`Setting parent in working graph: ${node.id} -> ${parent.id}`);
        if (workingGraph.hasNode(parent.id)) {
          workingGraph.setParent(node.id, parent.id, treeKey);
        } else {
          console.warn(`Parent ${parent.id} not found in working graph`);
        }
      }
    });
    
    console.log('Working graph roots:', workingGraph.getRoots(treeKey).map(r => r.id));
    return workingGraph;
  }


  async positionChildrenWithinParents(workingGraph, elements, treeKey) {
    // Group elements by their parent combo
    const elementsByParent = new Map();
    
    elements.forEach(element => {
      const parent = workingGraph.getParent(element.id, treeKey);
      const parentId = parent ? parent.id : 'no-parent';
      
      if (!elementsByParent.has(parentId)) {
        elementsByParent.set(parentId, []);
      }
      elementsByParent.get(parentId).push(element);
    });

    // Position children within each parent combo's bounds
    for (const [parentId, children] of elementsByParent) {
      if (parentId === 'no-parent') {
        // Elements without parents use ConcentricLayout normally
        console.log(`📍 Positioning ${children.length} parentless elements with ConcentricLayout`);
        await this.positionElementsAtLevel(children, 0);
        continue;
      }

      const parentCombo = workingGraph.getNode(parentId);
      const parentCenter = { 
        x: parentCombo.data.x || 0, 
        y: parentCombo.data.y || 0 
      };

      console.log(`📍 Positioning ${children.length} children within parent ${parentId} centered at (${parentCenter.x}, ${parentCenter.y})`);

      if (children.length === 1) {
        // Single child: place at parent center
        children[0].data.x = parentCenter.x;
        children[0].data.y = parentCenter.y;
        console.log(`  Single child ${children[0].id} positioned at parent center`);
      } else {
        // Multiple children: use ConcentricLayout within parent bounds
        const layoutNodes = children.map(child => ({
          id: child.id,
          data: { ...child.data }
        }));
        
        const layoutGraph = new GraphCore({ nodes: layoutNodes, edges: [] });
        
        // Intelligently estimate layout area based on number of children
        const baseSize = 80; // Base size per child
        const spacing = 60;   // Spacing between children
        const minSize = 120;  // Minimum layout area
        
        // Calculate layout area: base size per child + spacing between them
        const estimatedWidth = Math.max(minSize, (children.length * baseSize) + ((children.length - 1) * spacing));
        const estimatedHeight = Math.max(minSize, (children.length * baseSize) + ((children.length - 1) * spacing));
        
        // Use parent size if available and larger than estimate, otherwise use estimate
        const parentSize = parentCombo.data.size;
        const layoutWidth = parentSize && Array.isArray(parentSize) ? 
          Math.max(estimatedWidth, parentSize[0] * 0.8) : estimatedWidth;
        const layoutHeight = parentSize && Array.isArray(parentSize) ? 
          Math.max(estimatedHeight, parentSize[1] * 0.8) : estimatedHeight;
        
        console.log(`    Parent ${parentId} has ${children.length} children -> estimated layout: ${layoutWidth}x${layoutHeight}`);
        
        const layout = new ConcentricLayout({
          preventOverlap: true,
          center: [parentCenter.x, parentCenter.y],
          width: layoutWidth,
          height: layoutHeight,
          nodeSpacing: 20, // Tighter spacing within combos
          nodeSize: (node) => {
            const isCombo = !!node.data._isCombo;
            return isCombo ? 40 : 15; // Smaller sizes within parent combos
          }
        });

        await layout.assign(layoutGraph, {});

        // Copy positions back to original elements
        children.forEach(child => {
          const layoutNode = layoutGraph.getNode(child.id);
          child.data.x = layoutNode.data.x;
          child.data.y = layoutNode.data.y;
          console.log(`  Child ${child.id} positioned at (${child.data.x}, ${child.data.y})`);
        });
      }
    }
  }

  async cascadeParentSizing(workingGraph, currentDepth, treeKey, spacing) {
    console.log(`🔄 Cascading parent sizing back from depth ${currentDepth}`);
    
    // Update sizes and positions for all parent levels (from currentDepth-1 back to 0)
    for (let parentDepth = currentDepth - 1; parentDepth >= 0; parentDepth--) {
      const parentCombos = workingGraph.getAllNodes().filter(node => 
        node.data._isCombo && this.calculateComboDepth(workingGraph, node.id, treeKey) === parentDepth
      );

      if (parentCombos.length === 0) continue;

      console.log(`  📏 Updating sizes for ${parentCombos.length} combos at depth ${parentDepth}`);
      
      // Recalculate sizes based on current child positions
      parentCombos.forEach(combo => {
        const newSize = this.calculateComboSize(workingGraph, combo.id, treeKey);
        combo.data.size = newSize;
        console.log(`    Updated size for ${combo.id}: [${newSize[0]}, ${newSize[1]}]`);
      });

      // Get ALL elements at this depth level (combos + nodes) for repositioning
      const allElementsAtLevel = workingGraph.getAllNodes().filter(node => {
        if (node.data._isCombo) {
          return this.calculateComboDepth(workingGraph, node.id, treeKey) === parentDepth;
        } else {
          return this.calculateLeafNodeDepth(workingGraph, node, treeKey) === parentDepth;
        }
      });

      // If there are multiple elements OR if combo sizes changed, reposition the entire level
      if (allElementsAtLevel.length > 1 || parentCombos.length > 0) {
        console.log(`  📍 Repositioning entire level ${parentDepth} (${allElementsAtLevel.length} total elements) with updated sizes`);
        await this.positionElementsAtLevel(allElementsAtLevel, spacing);
        
        // After repositioning, update positions of children for any combos
        parentCombos.forEach(combo => {
          const newCenter = { x: combo.data.x || 0, y: combo.data.y || 0 };
          console.log(`    Updating children positions for ${combo.id} at new center (${newCenter.x}, ${newCenter.y})`);
          this.repositionDescendantsAroundCombo(workingGraph, combo.id, newCenter, treeKey);
        });
      }
    }
  }

  convertToG6Data(workingGraph) {
    const allNodes = workingGraph.getAllNodes();
    const allEdges = workingGraph.getAllEdges();
    
    return {
      nodes: allNodes.filter(n => !n.data._isCombo).map(n => ({
        id: n.id,
        style: {
          x: n.data.x,
          y: n.data.y,
          z: n.data.z || 0
        }
      })),
      edges: allEdges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target
      })),
      combos: allNodes.filter(n => n.data._isCombo).map(n => ({
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