import { describe, it, expect, beforeEach } from 'vitest';
import { SimpleBottomUpLayout } from '../../src/layouts/SimpleBottomUpLayout.js';
import { Graph as GraphCore } from '@antv/graphlib';

/**
 * Unit tests for SimpleBottomUpLayout
 * 
 * This test suite validates the layout's core functionality:
 * - Proper hierarchy depth calculation
 * - Level building with mixed elements
 * - Position cascading logic
 */

describe('SimpleBottomUpLayout', () => {
  let testData;
  
  beforeEach(() => {
    testData = {
      nodes: [
        // Public IP nodes (no combo - root level)
        { id: 'public1', data: { label: 'Public IP 1' }},
        { id: 'public2', data: { label: 'Public IP 2' }},
        
        // App 1 nodes (deepest level)
        { id: 'node1-1', combo: 'app1', data: { label: 'Node 1-1' }},
        { id: 'node1-2', combo: 'app1', data: { label: 'Node 1-2' }},
        
        // App 2 nodes
        { id: 'node2-1', combo: 'app2', data: { label: 'Node 2-1' }},
        
        // App 3 nodes
        { id: 'node3-1', combo: 'app3', data: { label: 'Node 3-1' }},
      ],
      
      edges: [
        { id: 'e1', source: 'node1-1', target: 'node2-1' },
        { id: 'e2', source: 'public1', target: 'node1-1' },
      ],
      
      combos: [
        // Root combo (depth 0)
        {
          id: 'private-network',
          data: { label: 'Private Network' }
        },
        
        // Cluster level (depth 1) 
        {
          id: 'cluster1',
          combo: 'private-network',
          data: { label: 'Cluster 1' }
        },
        
        // App level (depth 2 - deepest)
        {
          id: 'app1',
          combo: 'cluster1', 
          data: { label: 'Application 1' }
        },
        {
          id: 'app2', 
          combo: 'cluster1',
          data: { label: 'Application 2' }
        },
        {
          id: 'app3',
          combo: 'cluster1', 
          data: { label: 'Application 3' }
        }
      ]
    };
  });
  
  function createTestGraph(data) {
    // Simulate G6's preprocessing by adding _isCombo flags to combos
    // This mimics what G6 does in graphData2LayoutModel (utils/layout.js)
    const processedNodes = data.nodes.map(node => ({
      ...node,
      data: { ...node.data, _isCombo: false }
    }));
    
    const processedCombos = data.combos.map(combo => ({
      ...combo,
      data: { ...combo.data, _isCombo: true }
    }));
    
    const allNodes = [
      ...processedNodes,
      ...processedCombos
    ];
    
    const graphData = {
      nodes: allNodes,
      edges: data.edges
    };
    
    const graph = new GraphCore(graphData);
    
    // Mock the getChildren method for testing
    graph.getChildren = (nodeId, treeKey) => {
      if (treeKey !== 'combo') return [];
      
      // Return children based on our test data structure
      return allNodes.filter(node => node.combo === nodeId);
    };
    
    return graph;
  }

  describe('Constructor', () => {
    it('sets default options', () => {
      const layout = new SimpleBottomUpLayout();
      expect(layout.id).toBe('simple-bottom-up');
      expect(layout.options.treeKey).toBe('combo');
      expect(layout.options.spacing).toBe(50);
    });

    it('merges custom options', () => {
      const layout = new SimpleBottomUpLayout({ spacing: 100, custom: 'value' });
      expect(layout.options.spacing).toBe(100);
      expect(layout.options.custom).toBe('value');
      expect(layout.options.treeKey).toBe('combo'); // Should keep defaults
    });
  });

  describe('calculateComboDepth', () => {
    it('returns 0 for root combo (no parent)', () => {
      const graph = createTestGraph(testData);
      const layout = new SimpleBottomUpLayout();
      
      const depth = layout.calculateComboDepth(graph, 'private-network', 'combo');
      expect(depth).toBe(0);
    });

    it('returns correct depth for middle level combo', () => {
      const graph = createTestGraph(testData);
      const layout = new SimpleBottomUpLayout();
      
      const depth = layout.calculateComboDepth(graph, 'cluster1', 'combo');
      expect(depth).toBe(1);
    });

    it('returns correct depth for leaf combo', () => {
      const graph = createTestGraph(testData);
      const layout = new SimpleBottomUpLayout();
      
      const depth = layout.calculateComboDepth(graph, 'app1', 'combo');
      expect(depth).toBe(2);
    });
  });

  describe('calculateLeafNodeDepth', () => {
    it('returns correct depth for node in leaf combo', () => {
      const graph = createTestGraph(testData);
      const layout = new SimpleBottomUpLayout();
      
      const node = graph.getNode('node1-1');
      const depth = layout.calculateLeafNodeDepth(graph, node, 'combo');
      expect(depth).toBe(3); // app1 has depth 2, so node should be 2 + 1 = 3
    });

    it('returns 0 for root node (no combo)', () => {
      const graph = createTestGraph(testData);
      const layout = new SimpleBottomUpLayout();
      
      const node = graph.getNode('public1');
      const depth = layout.calculateLeafNodeDepth(graph, node, 'combo');
      expect(depth).toBe(0);
    });
  });

  describe('buildLevelsBottomUp', () => {
    it('creates correct hierarchy levels', () => {
      const graph = createTestGraph(testData);
      const layout = new SimpleBottomUpLayout();
      
      const levels = layout.buildLevelsBottomUp(graph, 'combo');
      
      // Should have 4 levels: 3, 2, 1, 0 (sorted bottom-up: deepest first)
      expect(levels).toHaveLength(4);
      expect(levels[0].depth).toBe(3); // First level should be depth 3 (leaf nodes)
      expect(levels[1].depth).toBe(2); // Second level should be depth 2 (leaf combos)  
      expect(levels[2].depth).toBe(1); // Third level should be depth 1 (middle combo)
      expect(levels[3].depth).toBe(0); // Fourth level should be depth 0 (root elements)
    });

    it('level 0 contains root elements', () => {
      const graph = createTestGraph(testData);
      const layout = new SimpleBottomUpLayout();
      
      const levels = layout.buildLevelsBottomUp(graph, 'combo');
      const level0 = levels.find(l => l.depth === 0);
      
      const elementIds = level0.elements.map(e => e.id);
      expect(elementIds).toContain('private-network');
      expect(elementIds).toContain('public1');
      expect(elementIds).toContain('public2');
    });

    it('level 1 contains cluster combo', () => {
      const graph = createTestGraph(testData);
      const layout = new SimpleBottomUpLayout();
      
      const levels = layout.buildLevelsBottomUp(graph, 'combo');
      const level1 = levels.find(l => l.depth === 1);
      
      const elementIds = level1.elements.map(e => e.id);
      expect(elementIds).toContain('cluster1');
    });

    it('level 2 contains leaf combos', () => {
      const graph = createTestGraph(testData);
      const layout = new SimpleBottomUpLayout();
      
      const levels = layout.buildLevelsBottomUp(graph, 'combo');
      const level2 = levels.find(l => l.depth === 2);
      
      const elementIds = level2.elements.map(e => e.id);
      expect(elementIds).toContain('app1');
      expect(elementIds).toContain('app2');
      expect(elementIds).toContain('app3');
    });

    it('level 3 contains leaf nodes', () => {
      const graph = createTestGraph(testData);
      const layout = new SimpleBottomUpLayout();
      
      const levels = layout.buildLevelsBottomUp(graph, 'combo');
      const level3 = levels.find(l => l.depth === 3);
      
      const elementIds = level3.elements.map(e => e.id);
      expect(elementIds).toContain('node1-1');
      expect(elementIds).toContain('node1-2');
      expect(elementIds).toContain('node2-1');
      expect(elementIds).toContain('node3-1');
    });
  });

  describe('cascadePositionToDescendants', () => {
    it('adjusts child positions by offset', () => {
      const graph = createTestGraph(testData);
      const layout = new SimpleBottomUpLayout();
      
      // Set initial positions for child nodes
      const node1 = graph.getNode('node1-1');
      const node2 = graph.getNode('node1-2');
      node1.data.x = 10;
      node1.data.y = 20;
      node2.data.x = 30;  
      node2.data.y = 40;
      
      // Cascade with offset
      const offset = { x: 100, y: 200 };
      layout.cascadePositionToDescendants(graph, 'app1', offset, 'combo');
      
      // Check positions were adjusted
      expect(node1.data.x).toBe(110);
      expect(node1.data.y).toBe(220);
      expect(node2.data.x).toBe(130);
      expect(node2.data.y).toBe(240);
    });
  });

  describe('Integration', () => {
    it('executes full layout and returns positioned nodes', async () => {
      const graph = createTestGraph(testData);
      const layout = new SimpleBottomUpLayout();
      
      // Mock the RandomLayout to avoid actual positioning
      const originalPositionElements = layout.positionElementsAtLevel;
      layout.positionElementsAtLevel = async function(elements) {
        // Just set some test positions
        elements.forEach((element, i) => {
          element.data.x = i * 50;
          element.data.y = i * 30;
        });
      };
      
      const result = await layout.execute(graph);
      
      // Restore original method
      layout.positionElementsAtLevel = originalPositionElements;
      
      // Verify result structure
      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('edges');
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(Array.isArray(result.edges)).toBe(true);
      
      // Verify all nodes have positions
      const allNodes = result.nodes;
      allNodes.forEach(node => {
        expect(typeof node.data.x).toBe('number');
        expect(typeof node.data.y).toBe('number');
      });
    });

    it('prevents overlap at each hierarchy level', async () => {
      const graph = createTestGraph(testData);
      const layout = new SimpleBottomUpLayout();
      
      const result = await layout.execute(graph);
      
      // Helper function to get node size based on layout logic
      const getNodeSize = (node) => {
        if (node.data._isCombo) {
          return node.data.size ? 
            (Array.isArray(node.data.size) ? Math.max(node.data.size[0], node.data.size[1]) : node.data.size) : 
            100; // Default combo size
        }
        return 30; // Default node size
      };
      
      // Helper function to check if two nodes overlap
      const checkOverlap = (node1, node2) => {
        const size1 = getNodeSize(node1);
        const size2 = getNodeSize(node2);
        const radius1 = size1 / 2;
        const radius2 = size2 / 2;
        
        const dx = node1.data.x - node2.data.x;
        const dy = node1.data.y - node2.data.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = radius1 + radius2;
        
        return distance < minDistance;
      };
      
      // Build levels to test each level separately
      const levels = layout.buildLevelsBottomUp(graph, 'combo');
      
      levels.forEach(level => {
        const elementsAtLevel = level.elements;
        
        // Check all pairs of elements at this level for overlap
        for (let i = 0; i < elementsAtLevel.length; i++) {
          for (let j = i + 1; j < elementsAtLevel.length; j++) {
            const node1 = elementsAtLevel[i];
            const node2 = elementsAtLevel[j];
            
            const hasOverlap = checkOverlap(node1, node2);
            
            if (hasOverlap) {
              const size1 = getNodeSize(node1);
              const size2 = getNodeSize(node2);
              const dx = node1.data.x - node2.data.x;
              const dy = node1.data.y - node2.data.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              console.log(`OVERLAP DETECTED at level ${level.depth}:`);
              console.log(`  ${node1.id} at (${node1.data.x}, ${node1.data.y}) size=${size1}`);
              console.log(`  ${node2.id} at (${node2.data.x}, ${node2.data.y}) size=${size2}`);
              console.log(`  Distance: ${distance}, Required: ${(size1 + size2) / 2}`);
            }
            
            expect(hasOverlap).toBe(false);
          }
        }
      });
    });
  });
});