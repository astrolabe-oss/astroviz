<template>
  <div>
    <div id="d3-graph-container" style="width: 100vw; height: 100vh;"></div>
  </div>
</template>

<script>
import { graphRenderer } from '@/components/graph/renderer/graphRenderer.js';

export default {
  name: 'G6Test',
  
  data() {
    return {
      graph: null
    };
  },
  
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
      // Test data in vertices/edges format (matching G6 test data structure and styling)
      const data = {
        vertices: {
          // Groups (hierarchical structure)
          'private-network': { 
            label: 'Private Network', 
            type: 'group',
            parentId: null,
            fill: '#f0f0f0',
            stroke: '#888'
          },
          'cluster1': { 
            label: 'Cluster 1', 
            type: 'group',
            parentId: 'private-network',
            fill: '#E8F4FD',
            stroke: '#5B8FF9'
          },
          'cluster2': { 
            label: 'Cluster 2', 
            type: 'group',
            parentId: 'private-network',
            fill: '#FFF2CC',
            stroke: '#D6B656'
          },
          'app1': { 
            label: 'Application 1 (3 nodes)', 
            type: 'group',
            parentId: 'cluster1',
            fill: '#FFE6CC',
            stroke: '#FF9933'
          },
          'app2': { 
            label: 'Application 2 (2 nodes)', 
            type: 'group',
            parentId: 'cluster1',
            fill: '#FFE6CC',
            stroke: '#FF9933'
          },
          'app3': { 
            label: 'Application 3 (1 node)', 
            type: 'group',
            parentId: 'cluster1',
            fill: '#FFE6CC',
            stroke: '#FF9933'
          },
          'app4': { 
            label: 'Application 4 (2 nodes)', 
            type: 'group',
            parentId: 'cluster2',
            fill: '#E1D5E7',
            stroke: '#9673A6'
          },
          'app5': { 
            label: 'Application 5 (3 nodes)', 
            type: 'group',
            parentId: 'cluster2',
            fill: '#E1D5E7',
            stroke: '#9673A6'
          },
          
          // Public IP nodes (no parent)
          'public1': { label: 'Public IP 1', type: 'node', fill: '#FF6B6B' },
          'public2': { label: 'Public IP 2', type: 'node', fill: '#FF6B6B' },
          'public3': { label: 'Public IP 3', type: 'node', fill: '#FF6B6B' },
          'public4': { label: 'Public IP 4', type: 'node', fill: '#FF6B6B' },
          'public5': { label: 'Public IP 5', type: 'node', fill: '#FF6B6B' },
          'public6': { label: 'Public IP 6', type: 'node', fill: '#FF6B6B' },
          'public7': { label: 'Public IP 7', type: 'node', fill: '#FF6B6B' },
          'public8': { label: 'Public IP 8', type: 'node', fill: '#FF6B6B' },
          'public9': { label: 'Public IP 9', type: 'node', fill: '#FF6B6B' },
          'public10': { label: 'Public IP 10', type: 'node', fill: '#FF6B6B' },
          
          // Cluster 1 - App 1 nodes
          'node1-1': { label: 'Node 1-1', type: 'node', parentId: 'app1', fill: '#4ECDC4' },
          'node1-2': { label: 'Node 1-2', type: 'node', parentId: 'app1', fill: '#4ECDC4' },
          'node1-3': { label: 'Node 1-3', type: 'node', parentId: 'app1', fill: '#4ECDC4' },
          
          // Cluster 1 - App 2 nodes
          'node2-1': { label: 'Node 2-1', type: 'node', parentId: 'app2', fill: '#4ECDC4' },
          'node2-2': { label: 'Node 2-2', type: 'node', parentId: 'app2', fill: '#4ECDC4' },
          
          // Cluster 1 - App 3 nodes
          'node3-1': { label: 'Node 3-1', type: 'node', parentId: 'app3', fill: '#45B7D1' },
          
          // Cluster 2 - App 4 nodes
          'node4-1': { label: 'Node 4-1', type: 'node', parentId: 'app4', fill: '#95E1D3' },
          'node4-2': { label: 'Node 4-2', type: 'node', parentId: 'app4', fill: '#95E1D3' },
          
          // Cluster 2 - App 5 nodes
          'node5-1': { label: 'Node 5-1', type: 'node', parentId: 'app5', fill: '#F38BA8' },
          'node5-2': { label: 'Node 5-2', type: 'node', parentId: 'app5', fill: '#F38BA8' },
          'node5-3': { label: 'Node 5-3', type: 'node', parentId: 'app5', fill: '#F38BA8' }
        },
        
        edges: [
          // Cluster 1 - Inter-application edges
          { source: 'node1-1', target: 'node2-1' },
          { source: 'node1-2', target: 'node2-2' },
          { source: 'node2-1', target: 'node3-1' },
          { source: 'node1-3', target: 'node3-1' },
          
          // Cluster 2 - Inter-application edges
          { source: 'node4-1', target: 'node5-1' },
          { source: 'node4-2', target: 'node5-2' },
          { source: 'node5-1', target: 'node5-3' },
          
          // Public IP connections
          { source: 'public1', target: 'node1-1' },
          { source: 'public2', target: 'node2-1' },
          { source: 'public3', target: 'node3-1' },
          { source: 'public1', target: 'node1-3' },
          { source: 'public2', target: 'node4-1' },
          { source: 'public3', target: 'node5-2' },
          { source: 'public4', target: 'node1-2' },
          { source: 'public5', target: 'node2-2' },
          { source: 'public6', target: 'node4-2' },
          { source: 'public7', target: 'node5-1' },
          { source: 'public8', target: 'node5-3' },
          { source: 'public9', target: 'node1-1' },
          { source: 'public10', target: 'node3-1' },
          { source: 'public4', target: 'node5-2' },
          { source: 'public7', target: 'node1-3' }
        ]
      };
      
      // Create D3 Graph (no G6!)
      const container = document.getElementById('d3-graph-container');
      this.graph = new graphRenderer.js(container, {
        width: window.innerWidth,
        height: window.innerHeight,
        padding: 0,
        nodeRadius: 15
      });
      
      // Set data
      this.graph.setData(data);
      
      console.log('D3 Graph loaded (no G6)');
    }
  }
};
</script>

<style scoped>
#d3-graph-container {
  background-color: #f8f9fa;
}
</style>