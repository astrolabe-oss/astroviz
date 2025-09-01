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
    
    // 1. Build levels from bottom to top using the real graph
    const levels = this.buildLevelsBottomUp(graph, treeKey, comboIds);
    console.log('Built levels:', levels.map(level => ({
      depth: level.depth,
      elements: level.elements.map(e => `${e.id}${comboIds.has(e.id) ? '(combo)' : '(node)'}`)
    })));

    // 2. Process each level from shallowest to deepest (top-down)
    for (let currentDepth = 0; currentDepth <= Math.max(...levels.map(l => l.depth)); currentDepth++) {
      const level = levels.find(l => l.depth === currentDepth);
      if (!level || level.elements.length === 0) continue;

      console.log(`\n--- Processing Level ${level.depth} ---`);
      console.log('Elements at this level:', level.elements.map(e => `${e.id}${comboIds.has(e.id) ? '(combo)' : '(node)'}`));

      if (level.depth === 0) {
        // Level 0: Position root combos with default sizes
        console.log('📍 Positioning root level elements');
        await this.positionElementsAtLevel(level.elements, spacing, comboIds);
      } else {
        // Level 1+: Position children centered within their parent combo bounds
        console.log(`📍 Positioning Level ${level.depth} elements within their parent combos`);
        await this.positionChildrenWithinParents(graph, level.elements, treeKey, comboIds);
      }

      // After positioning this level, cascade back and update parent sizes
      await this.cascadeParentSizing(graph, currentDepth, treeKey, spacing, comboIds);
      
      console.log(`✅ Completed Level ${level.depth}`);
    }

    console.log('=== Layout Complete ===');
    
    // Convert back to G6 format
    const result = this.convertToG6Data(graph, comboIds);
    return result;
  }

  buildLevelsBottomUp(graph, treeKey, comboIds) {
    const levels = new Map(); // depth -> { depth, elements: [] }
    const allNodes = graph.getAllNodes();

    console.log('DEBUG: Total nodes to process:', allNodes.length);

    // Calculate depth for each node (combo or leaf)
    allNodes.forEach(node => {
      let depth;

      if (comboIds.has(node.id)) {
        // For combos, calculate based on hierarchy
        depth = this.calculateComboDepth(graph, node.id, treeKey);
      } else {
        // For leaf nodes, determine level based on parent combo
        const parent = graph.getParent(node.id, treeKey);
        if (parent) {
          const parentDepth = this.calculateComboDepth(graph, parent.id, treeKey);
          depth = parentDepth + 1;
        } else {
          depth = 0; // Root node with no parent
        }
      }

      if (!levels.has(depth)) {
        levels.set(depth, { depth, elements: [] });
      }
      levels.get(depth).elements.push(node);
    });

    // Return levels sorted top-down (shallowest level first, deepest level last)
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
      depthCache.set(comboId, 0);
      return 0;
    }

    // This combo has a parent, so its depth is parent depth + 1
    const parentDepth = this.calculateComboDepth(graph, parent.id, treeKey, depthCache);
    const depth = parentDepth + 1;
    depthCache.set(comboId, depth);
    return depth;
  }

  async positionElementsAtLevel(elements, spacing, comboIds) {
    if (elements.length === 0) return;
    
    // SPECIAL HANDLING: Check if this is root level with orphan nodes
    const rootCombos = elements.filter(el => comboIds.has(el.id));
    const rootNodes = elements.filter(el => !comboIds.has(el.id));
    const hasOrphanNodes = rootCombos.length > 0 && rootNodes.length > 0;
    
    if (hasOrphanNodes) {
      console.log('📍 Using custom tight circle packing for root level with orphan nodes');
      return this.positionRootLevelTight(elements, comboIds);
    }

    // Normal ConcentricLayout for other cases
    const layoutNodes = elements.map(element => ({
      id: element.id,
      data: { ...element.data }
    }));

    const layoutGraph = new GraphCore({ nodes: layoutNodes, edges: [] });

    // Calculate total size needed
    const totalSize = elements.reduce((sum, element) => {
      if (comboIds.has(element.id) && element.data.size) {
        const size = Array.isArray(element.data.size) ? Math.max(...element.data.size) : element.data.size;
        return sum + size;
      }
      return sum + 60; // Default for nodes
    }, 0);
    
    const layoutWidth = Math.max(800, totalSize * 1.5);
    const layoutHeight = Math.max(600, totalSize * 1.2);
    
    const layout = new ConcentricLayout({
      preventOverlap: true,
      center: [0, 0],
      width: layoutWidth,
      height: layoutHeight,
      nodeSpacing: spacing,
      nodeSize: (node) => {
        const isCombo = comboIds.has(node.id);
        
        if (isCombo) {
          if (node.data.size) {
            const size = node.data.size;
            const radius = Array.isArray(size) ? Math.max(size[0], size[1]) / 2 : size / 2;
            return radius;
          }
          return 80;  // Default combo radius
        }
        
        // Regular node
        if (node.data.size) {
          const nodeSize = Array.isArray(node.data.size) ? node.data.size[0] : node.data.size;
          return nodeSize / 2;
        }
        
        return 25; // Default node radius
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
  
  positionRootLevelTight(elements, comboIds) {
    // Separate combos from orphan nodes dynamically
    const rootCombos = elements.filter(el => comboIds.has(el.id));
    const orphanNodes = elements.filter(el => !comboIds.has(el.id));
    
    if (rootCombos.length === 0) {
      console.warn('No root combos found at root level');
      return;
    }
    
    // Find the largest combo to use as the central element
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
    console.log(`  ${centralCombo.id}: positioned at center (0, 0)`);
    
    // Position other combos if any
    const otherCombos = rootCombos.filter(combo => combo.id !== centralCombo.id);
    if (otherCombos.length > 0) {
      const comboAngleStep = (2 * Math.PI) / otherCombos.length;
      const comboDistance = 200;
      
      otherCombos.forEach((combo, index) => {
        const angle = index * comboAngleStep;
        combo.data.x = comboDistance * Math.cos(angle);
        combo.data.y = comboDistance * Math.sin(angle);
        console.log(`  ${combo.id}: positioned at (${combo.data.x.toFixed(2)}, ${combo.data.y.toFixed(2)})`);
      });
    }
    
    // Position orphan nodes around the central combo
    if (orphanNodes.length > 0) {
      const comboRadius = centralCombo.data.size ? 
        (Array.isArray(centralCombo.data.size) ? Math.max(...centralCombo.data.size) / 2 : centralCombo.data.size / 2) : 
        80;
      const nodeRadius = 25;
      const gap = 20;
      const distance = comboRadius + nodeRadius + gap;
      
      const angleStep = (2 * Math.PI) / orphanNodes.length;
      orphanNodes.forEach((node, index) => {
        const angle = index * angleStep - Math.PI / 2;
        node.data.x = distance * Math.cos(angle);
        node.data.y = distance * Math.sin(angle);
        console.log(`  ${node.id}: positioned at (${node.data.x.toFixed(2)}, ${node.data.y.toFixed(2)}) - distance: ${distance}, angle: ${(angle * 180 / Math.PI).toFixed(1)}°`);
      });
    }
  }

  calculateComboSize(graph, comboId, treeKey, comboIds) {
    const children = graph.getChildren(comboId, treeKey) || [];
    
    console.log(`🔍 Calculating size for combo ${comboId} with ${children.length} children`);
    
    if (children.length === 0) {
      console.log(`  Empty combo ${comboId} -> using default size [80, 80]`);
      return [80, 80];
    }

    // Create bounding boxes for all children
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
      
      console.log(`    Child ${child.id} bbox: center(${x}, ${y}) size(${width}x${height})`);
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
    
    console.log(`  Bbox: [${width}, ${height}] -> CircleCombo radius: ${circleRadius} (diameter: ${circleDiameter})`);
    return [circleDiameter, circleDiameter];
  }

  repositionDescendantsAroundCombo(graph, comboId, comboCenter, treeKey, comboIds) {
    const children = graph.getChildren(comboId, treeKey);
    if (!children || children.length === 0) return;

    // Calculate current center of children
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    children.forEach(child => {
      const x = child.data.x || 0;
      const y = child.data.y || 0;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });

    const childrenCenter = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    };

    // Calculate offset to center children
    const offset = {
      x: comboCenter.x - childrenCenter.x,
      y: comboCenter.y - childrenCenter.y
    };

    // Apply offset to all children
    children.forEach(child => {
      child.data.x = (child.data.x || 0) + offset.x;
      child.data.y = (child.data.y || 0) + offset.y;
      console.log(`  Repositioned ${child.id}: (${child.data.x}, ${child.data.y})`);

      // Recursively reposition if it's a combo
      if (comboIds.has(child.id)) {
        this.repositionDescendantsAroundCombo(graph, child.id, {
          x: child.data.x,
          y: child.data.y
        }, treeKey, comboIds);
      }
    });
  }

  async positionChildrenWithinParents(graph, elements, treeKey, comboIds) {
    // Group elements by their parent combo
    const elementsByParent = new Map();
    
    elements.forEach(element => {
      const parent = graph.getParent(element.id, treeKey);
      const parentId = parent ? parent.id : 'no-parent';
      
      if (!elementsByParent.has(parentId)) {
        elementsByParent.set(parentId, []);
      }
      elementsByParent.get(parentId).push(element);
    });

    // Position children within each parent combo's bounds
    for (const [parentId, children] of elementsByParent) {
      if (parentId === 'no-parent') {
        // Elements without parents
        console.log(`📍 Positioning ${children.length} parentless elements`);
        await this.positionElementsAtLevel(children, 0, comboIds);
        continue;
      }

      const parentCombo = graph.getNode(parentId);
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
        
        // Calculate layout area
        const baseSize = 80;
        const spacing = 60;
        const minSize = 120;
        const estimatedWidth = Math.max(minSize, (children.length * baseSize) + ((children.length - 1) * spacing));
        const estimatedHeight = Math.max(minSize, (children.length * baseSize) + ((children.length - 1) * spacing));
        
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
          nodeSpacing: 20,
          nodeSize: (node) => {
            const isCombo = comboIds.has(node.id);
            return isCombo ? 40 : 15;
          }
        });

        await layout.assign(layoutGraph, {});

        // Copy positions back
        children.forEach(child => {
          const layoutNode = layoutGraph.getNode(child.id);
          child.data.x = layoutNode.data.x;
          child.data.y = layoutNode.data.y;
          console.log(`  Child ${child.id} positioned at (${child.data.x}, ${child.data.y})`);
        });
      }
    }
  }

  async cascadeParentSizing(graph, currentDepth, treeKey, spacing, comboIds) {
    console.log(`🔄 Cascading parent sizing back from depth ${currentDepth}`);
    
    // Update sizes and positions for all parent levels
    for (let parentDepth = currentDepth - 1; parentDepth >= 0; parentDepth--) {
      const parentCombos = graph.getAllNodes().filter(node => 
        comboIds.has(node.id) && this.calculateComboDepth(graph, node.id, treeKey) === parentDepth
      );

      if (parentCombos.length === 0) continue;

      console.log(`  📏 Updating sizes for ${parentCombos.length} combos at depth ${parentDepth}`);
      
      // Recalculate sizes based on current child positions
      parentCombos.forEach(combo => {
        const newSize = this.calculateComboSize(graph, combo.id, treeKey, comboIds);
        combo.data.size = newSize;
        console.log(`    Updated size for ${combo.id}: [${newSize[0]}, ${newSize[1]}]`);
      });

      // Get ALL elements at this depth level for repositioning
      const allElementsAtLevel = graph.getAllNodes().filter(node => {
        if (comboIds.has(node.id)) {
          return this.calculateComboDepth(graph, node.id, treeKey) === parentDepth;
        } else {
          // For regular nodes, check if they belong to this depth
          const parent = graph.getParent(node.id, treeKey);
          if (!parent && parentDepth === 0) {
            return true; // Root nodes
          }
          if (parent) {
            const nodeParentDepth = this.calculateComboDepth(graph, parent.id, treeKey);
            return nodeParentDepth + 1 === parentDepth;
          }
          return false;
        }
      });

      // Reposition the entire level if needed
      if (allElementsAtLevel.length > 1 || parentCombos.length > 0) {
        console.log(`  📍 Repositioning entire level ${parentDepth} (${allElementsAtLevel.length} total elements) with updated sizes`);
        await this.positionElementsAtLevel(allElementsAtLevel, spacing, comboIds);
        
        // Update children positions for combos
        parentCombos.forEach(combo => {
          const newCenter = { x: combo.data.x || 0, y: combo.data.y || 0 };
          console.log(`    Updating children positions for ${combo.id} at new center (${newCenter.x}, ${newCenter.y})`);
          this.repositionDescendantsAroundCombo(graph, combo.id, newCenter, treeKey, comboIds);
        });
      }
    }
  }

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