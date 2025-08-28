<template>
  <div id="g6-test-container" style="width: 100vw; height: 100vh;"></div>
</template>

<script>
import { Graph, register, ExtensionCategory } from '@antv/g6';
import { AntVDagreLayout, D3ForceLayout, MDSLayout, DagreLayout ,ForceAtlas2Layout, ForceLayout, ConcentricLayout, GridLayout, RandomLayout, RadialLayout} from '@antv/layout';
import { CustomComboCombinedLayout } from '@/layouts/CustomComboCombinedLayout.js';
import { SimpleBottomUpLayout } from '@/layouts/SimpleBottomUpLayout.js';

// Register our custom layouts
register(ExtensionCategory.LAYOUT, 'custom-combo-combined', CustomComboCombinedLayout);
register(ExtensionCategory.LAYOUT, 'simple-bottom-up', SimpleBottomUpLayout);

export default {
  name: 'G6Test',
  
  mounted() {
    this.initGraph();
  },
  
  beforeDestroy() {
    if (this.graph) {
      this.graph.destroy();
    }
  },
  
  methods: {
    initGraph() {
      // Dummy data with 3-level hierarchy
      const data = {
        nodes: [
          // Public IP nodes (no combo)
          { id: 'public1', data: { label: 'Public IP 1', type: 'public', fill: '#FF6B6B' }},
          { id: 'public2', data: { label: 'Public IP 2', type: 'public', fill: '#FF6B6B' }},
          { id: 'public3', data: { label: 'Public IP 3', type: 'public', fill: '#FF6B6B' }},
          
          // Cluster 1 - App 1 nodes
          { id: 'node1-1', combo: 'app1', data: { label: 'Node 1-1', type: 'compute', fill: '#4ECDC4' }},
          { id: 'node1-2', combo: 'app1', data: { label: 'Node 1-2', type: 'compute', fill: '#4ECDC4' }},
          { id: 'node1-3', combo: 'app1', data: { label: 'Node 1-3', type: 'compute', fill: '#4ECDC4' }},
          
          // Cluster 1 - App 2 nodes
          { id: 'node2-1', combo: 'app2', data: { label: 'Node 2-1', type: 'compute', fill: '#4ECDC4' }},
          { id: 'node2-2', combo: 'app2', data: { label: 'Node 2-2', type: 'compute', fill: '#4ECDC4' }},
          
          // Cluster 1 - App 3 nodes
          { id: 'node3-1', combo: 'app3', data: { label: 'Node 3-1', type: 'resource', fill: '#45B7D1' }},
          
          // Cluster 2 - App 4 nodes
          { id: 'node4-1', combo: 'app4', data: { label: 'Node 4-1', type: 'compute', fill: '#95E1D3' }},
          { id: 'node4-2', combo: 'app4', data: { label: 'Node 4-2', type: 'compute', fill: '#95E1D3' }},
          
          // Cluster 2 - App 5 nodes
          { id: 'node5-1', combo: 'app5', data: { label: 'Node 5-1', type: 'resource', fill: '#F38BA8' }},
          { id: 'node5-2', combo: 'app5', data: { label: 'Node 5-2', type: 'resource', fill: '#F38BA8' }},
          { id: 'node5-3', combo: 'app5', data: { label: 'Node 5-3', type: 'resource', fill: '#F38BA8' }}
        ],
        
        edges: [
          // Cluster 1 - Inter-application edges (within cluster only)
          { id: 'e1', source: 'node1-1', target: 'node2-1' },
          { id: 'e2', source: 'node1-2', target: 'node2-2' },
          { id: 'e3', source: 'node2-1', target: 'node3-1' },
          { id: 'e4', source: 'node1-3', target: 'node3-1' },
          
          // Cluster 2 - Inter-application edges (within cluster only)
          { id: 'e9', source: 'node4-1', target: 'node5-1' },
          { id: 'e10', source: 'node4-2', target: 'node5-2' },
          { id: 'e11', source: 'node5-1', target: 'node5-3' },
          
          // Public IP connections (to both clusters)
          { id: 'e5', source: 'public1', target: 'node1-1' },
          { id: 'e6', source: 'public2', target: 'node2-1' },
          { id: 'e7', source: 'public3', target: 'node3-1' },
          { id: 'e8', source: 'public1', target: 'node1-3' },
          { id: 'e12', source: 'public2', target: 'node4-1' },
          { id: 'e13', source: 'public3', target: 'node5-2' }
        ],
        
        combos: [
          // Top level - Private Network
          {
            id: 'private-network',
            data: {
              label: 'Private Network',
              fill: '#f0f0f0',
              stroke: '#888'
            }
          },
          
          // Cluster level
          {
            id: 'cluster1',
            combo: 'private-network',  // G6 v5 uses 'combo' not 'parentId'
            data: {
              label: 'Cluster 1',
              fill: '#E8F4FD',
              stroke: '#5B8FF9'
            }
          },
          {
            id: 'cluster2',
            combo: 'private-network',
            data: {
              label: 'Cluster 2',
              fill: '#FFF2CC',
              stroke: '#D6B656'
            }
          },
          
          // Cluster 1 Applications
          {
            id: 'app1',
            combo: 'cluster1',
            data: {
              label: 'Application 1 (3 nodes)',
              fill: '#FFE6CC',
              stroke: '#FF9933'
            }
          },
          {
            id: 'app2',
            combo: 'cluster1',
            data: {
              label: 'Application 2 (2 nodes)',
              fill: '#FFE6CC',
              stroke: '#FF9933'
            }
          },
          {
            id: 'app3',
            combo: 'cluster1',
            data: {
              label: 'Application 3 (1 node)',
              fill: '#FFE6CC',
              stroke: '#FF9933'
            }
          },
          
          // Cluster 2 Applications
          {
            id: 'app4',
            combo: 'cluster2',
            data: {
              label: 'Application 4 (2 nodes)',
              fill: '#E1D5E7',
              stroke: '#9673A6'
            }
          },
          {
            id: 'app5',
            combo: 'cluster2',
            data: {
              label: 'Application 5 (3 nodes)',
              fill: '#E1D5E7',
              stroke: '#9673A6'
            }
          }
        ]
      };

      // Create G6 graph with d3-force layout
      this.graph = new Graph({
        container: 'g6-test-container',
        width: window.innerWidth,
        height: window.innerHeight,
        data: data,
        animation: true,
        // layout: {
        //   type: 'd3-force',
        //   collide: {
        //     radius: (node) => {
        //       // D3Force strips out the size property, so we need to look at the original node
        //       // The node here has the size directly on it from combo-combined
        //       const nodeSize = node.size;
        //       console.log('D3Force collide radius called for:', node.id, 'size:', nodeSize);
        //
        //       if (nodeSize && Array.isArray(nodeSize)) {
        //         const radius = Math.max(...nodeSize) / 2;
        //         console.log(`Combo ${node.id} collision radius: ${radius}`);
        //         return radius;
        //       }
        //       console.log(`Node ${node.id} default collision radius: 30`);
        //       return 30; // Default radius for regular nodes
        //     },
        //     strength: 1,
        //     iterations: 3
        //   },
        //   center: {
        //     x: window.innerWidth / 2,
        //     y: window.innerHeight / 2
        //   },
        //   manyBody: {
        //     strength: -300
        //   },
        //   link: {
        //     distance: 150
        //   }
        // },
        // Use our custom combo-combined layout
        layout: {
          type: 'simple-bottom-up',
          spacing: 50,
          comboPadding: 20
        },
        // layout: {
        //   // ForceAtlas2 with dynamic combo size calculation
        //   type: 'force-atlas2',
        //   preventOverlap: true,
        //   nodeSize: (node) => this.calculateNodeSize(node, data),
        //   kr: 100,      // Increase repulsive force
        //   kg: 5,        // Moderate gravity
        //   mode: 'normal'
        // },
        // layout: {
        //   animation: true,
        //   preventOverlap: true,
        //   type: 'custom-combo-combined',
        //   spacing: 50,  // Increased spacing between all nodes
        //   comboPadding: 20,  // Increased padding inside combos
        //   // Force layout for outer (combos and public nodes)
        //   outerLayout: new D3ForceLayout({
        //     collide: {
        //       radius: (node) => {
        //         // D3Force strips out the size property, so we need to look at the original node
        //         // The node here has the size directly on it from combo-combined
        //         const nodeSize = node.size;
        //         console.log('D3Force collide radius called for:', node.id, 'size:', nodeSize);
        //
        //         // Check if this is a combo
        //         const isCombo = data.combos.some(c => c.id === node.id);
        //
        //         if (isCombo) {
        //           // For combos, check if we have a calculated size
        //           if (nodeSize && Array.isArray(nodeSize)) {
        //             const baseRadius = Math.max(...nodeSize) / 2;
        //
        //             // If size is very small ([40,40]), it's likely a parent combo that needs estimation
        //             if (baseRadius <= 20) {
        //               const directChildCombos = data.combos.filter(c => c.combo === node.id);
        //
        //               if (directChildCombos.length > 0) {
        //                 // Parent combo - estimate based on child combos
        //                 const baseRadius = 100;
        //                 const radiusPerChildCombo = 80;
        //                 const estimated = baseRadius + (directChildCombos.length * radiusPerChildCombo);
        //                 console.log(`Parent combo ${node.id}: ${directChildCombos.length} child combos -> estimated radius ${estimated}`);
        //                 return estimated;
        //               }
        //             }
        //
        //             // For leaf combos with calculated sizes, use the actual size + margin
        //             const margin = 30;
        //             const radius = baseRadius + margin;
        //             console.log(`Combo ${node.id} calculated radius: ${radius} (size: ${nodeSize})`);
        //             return radius;
        //           }
        //
        //           // Fallback estimation for combos without size
        //           const directChildNodes = data.nodes.filter(n => n.combo === node.id);
        //           const baseRadius = 60;
        //           const radiusPerNode = 25;
        //           const estimated = baseRadius + (directChildNodes.length * radiusPerNode);
        //           console.log(`Combo ${node.id} fallback estimation: ${estimated}`);
        //           return estimated;
        //         }
        //
        //         // For regular nodes, use a standard radius
        //         console.log(`Regular node ${node.id} - using radius: 25`);
        //         return 25;
        //       },
        //       strength: 1,
        //       iterations: 3
        //     },
        //     center: {
        //       x: window.innerWidth / 2,
        //       y: window.innerHeight / 2
        //     },
        //     manyBody: {
        //       strength: -300
        //     },
        //     link: {
        //       distance: 150
        //     }
        //   }),
        //   // Concentric layout for inner (nodes within combos)
        //   // The nodeSize function is now handled by CustomComboCombinedLayout
        //   innerLayout: new ConcentricLayout({
        //     nodeSpacing: 50, // Increased spacing between nodes/combos
        //     preventOverlap: true,
        //     sortBy: 'degree'
        //   })
        // },
        
        // Node configuration
        node: {
          style: {
            size: 25,
            fill: (d) => d.data?.fill || '#C6E5FF',
            stroke: '#fff',
            lineWidth: 2,
            labelText: (d) => d.data?.label || d.id,
            labelFontSize: 12,
            labelOffsetY: 25
          }
        },
        
        // Edge configuration
        edge: {
          style: {
            stroke: '#999',
            lineWidth: 1,
            endArrow: true
          }
        },
        
        // Combo configuration
        combo: {
          style: {
            fill: (d) => d.data?.fill || '#E8F4FD',
            stroke: (d) => d.data?.stroke || '#5B8FF9',
            lineWidth: 2,
            labelText: (d) => d.data?.label || d.id,
            labelFontSize: 14,
            labelOffsetY: 20,
            opacity: 0.6,
            radius: 10,
            padding: [20, 20, 20, 20]
          }
        },
        
        // Behaviors
        behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element', 'collapse-expand'],
        autoFit: 'view'
      });

      // Render the graph
      this.graph.render();
      
      // Debug: Log all nodes after initial render
      console.log('=== Initial Graph Data ===');
      const graphData = this.graph.getData();
      console.log('Nodes:', graphData.nodes);
      console.log('Combos:', graphData.combos);
      
      // Check what ForceAtlas2 sees
      // setTimeout(() => {
      //   console.log('=== After Layout ===');
      //   const afterData = this.graph.getData();
      //   console.log('Nodes after layout:', afterData.nodes);
      //   console.log('Combos after layout:', afterData.combos);
      //
      //   // Check positions and properties
      //   afterData.nodes.forEach(node => {
      //     console.log(`Node ${node.id}:`, {
      //       combo: node.combo,
      //       position: { x: node.data?.x, y: node.data?.y },
      //       size: node.data?.size
      //     });
      //   });
      //
      //   if (afterData.combos) {
      //     afterData.combos.forEach(combo => {
      //       console.log(`Combo ${combo.id}:`, {
      //         parent: combo.combo,
      //         _isCombo: combo.data?._isCombo,
      //         position: { x: combo.data?.x, y: combo.data?.y },
      //         size: combo.data?.size
      //       });
      //     });
      //   }
      // }, 1000);

      // Console helper functions
      window.g6test = this.graph;
      
      window.expandAllTest = () => {
        const data = this.graph.getData();
        const combos = data.combos || [];
        combos.forEach(combo => {
          try {
            const comboData = this.graph.getComboData(combo.id);
            if (comboData) {
              this.graph.updateComboData([{
                id: combo.id,
                ...comboData,
                style: { ...comboData.style, collapsed: false }
              }]);
            }
          } catch (e) {
            console.error('Error expanding combo:', e);
          }
        });
        this.graph.render();
      };
      
      window.collapseAllTest = () => {
        const data = this.graph.getData();
        const combos = data.combos || [];
        combos.forEach(combo => {
          try {
            const comboData = this.graph.getComboData(combo.id);
            if (comboData) {
              this.graph.updateComboData([{
                id: combo.id,
                ...comboData,
                style: { ...comboData.style, collapsed: true }
              }]);
            }
          } catch (e) {
            console.error('Error collapsing combo:', e);
          }
        });
        this.graph.render();
      };
      
      console.log('G6 test graph loaded. Available commands:');
      console.log('- expandAllTest() - Expand all combos');
      console.log('- collapseAllTest() - Collapse all combos');
      console.log('- g6test - Access the G6 graph instance');
    }
  }
};
</script>

<style scoped>
#g6-test-container {
  background-color: #f8f9fa;
}
</style>