import { BaseLayout } from '@antv/g6';
import { pack, hierarchy } from 'd3';

export class SimpleBottomUpLayout extends BaseLayout {
  constructor(context, options = {}) {
    super(context, options);
    
    this.id = 'simple-bottom-up';
    this.options = {
      center: [0, 0],
      treeKey: 'combo',
      spacing: 0,
      comboPadding: 5,
      preLayout: true,  // Signal to G6 that this layout needs combo preprocessing
      ...options
    };
  }

  async execute(model, options) {
    const mergedOptions = { ...this.options, ...options };
    const { treeKey } = mergedOptions;

    console.log('=== Starting D3 Pack Layout ===');

    // Use the real G6 graph model directly
    const graph = this.context.model.model;
    const comboIds = new Set((model.combos || []).map(c => c.id));

    // 1. Build hierarchical data structure for D3
    const hierarchyData = this.buildHierarchyData(graph, treeKey, comboIds);
    console.log('Built hierarchy data:', JSON.stringify(hierarchyData, null, 2));
    
    // Debug: Check what the hierarchy looks like after D3 processes it
    const debugRoot = hierarchy(hierarchyData);
    console.log('D3 hierarchy structure:');
    debugRoot.each(d => {
      console.log(`Node ${d.data.id}: depth=${d.depth}, children=${d.children ? d.children.length : 0}, value=${d.data.value || 'none'}`);
    });

    // 2. Create D3 hierarchy and pack layout
    const root = hierarchy(hierarchyData)
      .sum(d => d.value || 1) // Leaf nodes get value of 1, combos sum their children
      .sort((a, b) => b.value - a.value);

    const packLayout = pack()
      .size([800, 600]) // Set reasonable container size
      .padding(5); // Add padding between circles

    const packedRoot = packLayout(root);

    console.log('D3 pack layout complete');

    // 3. Apply positions back to graph nodes
    this.applyPackedPositions(graph, packedRoot, comboIds);

    console.log('=== Layout Complete ===');
    
    // DEBUG: Render directly to SVG to bypass G6 and verify calculations
    this.debugRenderToSVG(packedRoot, comboIds);
    
    // Convert back to G6 format (commented out for debugging)
    const result = this.convertToG6Data(graph, comboIds);
    
    // Debug output the data we're returning to G6
    console.log('=== G6 Output Data ===');
    console.log('Nodes:', result.nodes);
    console.log('Combos:', result.combos);
    
    return result;
  }

  /**
   * Build hierarchical data structure for D3 pack layout
   */
  buildHierarchyData(graph, treeKey, comboIds) {
    const roots = graph.getRoots(treeKey);
    
    // Create virtual root to handle multiple root elements
    const rootData = {
      id: '__virtual_root__',
      children: []
    };

    // Process each root element
    roots.forEach(root => {
      const nodeData = this.buildNodeData(graph, root, treeKey, comboIds);
      rootData.children.push(nodeData);
    });

    return rootData;
  }

  /**
   * Recursively build node data structure
   */
  buildNodeData(graph, node, treeKey, comboIds) {
    const nodeData = {
      id: node.id,
      originalNode: node
    };

    const children = graph.getChildren(node.id, treeKey) || [];
    
    if (children.length > 0) {
      // This is a combo with children
      nodeData.children = children.map(child => 
        this.buildNodeData(graph, child, treeKey, comboIds)
      );
    } else {
      // This is a leaf node - use the actual node size from data
      const nodeSize = node.data.size; // Default to 30 if no size specified
      nodeData.value = nodeSize;
    }

    return nodeData;
  }

  /**
   * Apply packed positions back to graph nodes
   */
  applyPackedPositions(graph, packedRoot, comboIds) {
    // Traverse the packed hierarchy and apply positions
    const applyToNode = (packedNode) => {
      if (packedNode.data.originalNode) {
        const originalNode = packedNode.data.originalNode;
        originalNode.data.x = packedNode.x;
        originalNode.data.y = packedNode.y;
        
        if (comboIds.has(originalNode.id)) {
          // For combos, store the calculated radius as diameter
          originalNode.data.size = packedNode.r * 2;
        } else {
          // For leaf nodes, also store the size so G6 renders them correctly
          originalNode.data.size = packedNode.r * 2;
        }
        
        console.log(`Applied position to ${originalNode.id}: (${packedNode.x.toFixed(1)}, ${packedNode.y.toFixed(1)}) r=${packedNode.r.toFixed(1)}`);
      }
      
      // Recursively apply to children
      if (packedNode.children) {
        packedNode.children.forEach(child => applyToNode(child));
      }
    };

    applyToNode(packedRoot);
  }

  /**
   * DEBUG: Render D3 pack layout directly to SVG to verify calculations
   */
  debugRenderToSVG(packedRoot, comboIds) {
    // Remove any existing debug SVG
    const existingSvg = document.getElementById('debug-pack-svg');
    if (existingSvg) {
      existingSvg.remove();
    }

    // Create debug SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'debug-pack-svg';
    svg.setAttribute('width', '1000');
    svg.setAttribute('height', '800');
    svg.style.position = 'fixed';
    svg.style.top = '100px';  // Moved down to avoid button
    svg.style.right = '10px';
    svg.style.border = '2px solid red';
    svg.style.background = 'white';
    svg.style.zIndex = '9999';

    // Add title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', '10');
    title.setAttribute('y', '20');
    title.setAttribute('fill', 'red');
    title.setAttribute('font-size', '14');
    title.setAttribute('font-weight', 'bold');
    title.textContent = 'DEBUG: D3 Pack Layout (Raw)';
    svg.appendChild(title);

    // Render all circles from the packed hierarchy
    const renderNode = (packedNode, isCombo) => {
      if (packedNode.data.id === '__virtual_root__') {
        // Skip virtual root, just render children
        if (packedNode.children) {
          packedNode.children.forEach(child => {
            const childIsCombo = comboIds.has(child.data.id);
            renderNode(child, childIsCombo);
          });
        }
        return;
      }

      // Create circle element
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', packedNode.x);
      circle.setAttribute('cy', packedNode.y);
      circle.setAttribute('r', packedNode.r);
      
      // Style based on type
      if (isCombo) {
        circle.setAttribute('fill', 'rgba(0, 100, 200, 0.1)');
        circle.setAttribute('stroke', 'blue');
        circle.setAttribute('stroke-width', '2');
      } else {
        circle.setAttribute('fill', 'rgba(200, 100, 0, 0.3)');
        circle.setAttribute('stroke', 'orange');
        circle.setAttribute('stroke-width', '1');
      }

      svg.appendChild(circle);

      // Add label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', packedNode.x);
      text.setAttribute('y', packedNode.y);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('font-size', '10');
      text.setAttribute('fill', 'black');
      text.textContent = `${packedNode.data.id} (r=${packedNode.r.toFixed(1)})`;
      svg.appendChild(text);

      // Recursively render children
      if (packedNode.children) {
        packedNode.children.forEach(child => {
          const childIsCombo = comboIds.has(child.data.id);
          renderNode(child, childIsCombo);
        });
      }
    };

    renderNode(packedRoot, false);

    // Append to body
    document.body.appendChild(svg);
    
    console.log('DEBUG SVG rendered - check top-right corner of page');
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
          z: n.data.z || 0,
          size: n.data.size
        }
      })),
      edges: [], // Edges remain unchanged
      combos: allNodes.filter(n => comboIds.has(n.id)).map(n => ({
        id: n.id,
        style: {
          x: n.data.x,
          y: n.data.y
          // Don't pass size - let G6 calculate from children
        }
      }))
    };
  }
}