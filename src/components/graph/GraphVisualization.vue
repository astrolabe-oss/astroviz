<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div id="d3-graph-container" class="d3-widget"></div>
</template>

<script>
import { GraphRenderer } from './renderer/graphRenderer.js';

export default {
  name: 'GraphVisualization',

  props: {
    graphData: {
      type: Object,
      required: true,
      default: () => ({ vertices: {}, edges: [] })
    },
    viewMode: {
      type: String,
      required: true,
      default: 'detailed'
    },
    nodeColors: {
      type: Object,
      required: true
    },
    // Set of node IDs that should be highlighted (from filters)
    highlightedNodeIds: {
      type: Set,
      default: () => new Set()
    }
  },

  data() {
    return {
      graph: null
    };
  },

  mounted() {
    console.log('GraphVisualization mounted, waiting for DOM...');
    this.$nextTick(() => {
      console.log('DOM ready, initializing D3 Graph');
      this.initializeD3Graph();
    });
  },

  beforeDestroy() {
    if (this.graph) {
      console.log('Destroying D3 Graph instance');
      this.graph.destroy();
    }
  },

  watch: {
    graphData: {
      handler(newData) {
        console.log('GraphData changed, updating graph');
        this.updateGraph(newData);
      },
      deep: true
    },
    
    highlightedNodeIds: {
      handler(newHighlighted) {
        console.log('HighlightedNodeIds changed, updating filter highlights');
        if (this.graph) {
          this.graph.setFilterHighlights(newHighlighted);
        }
      },
      immediate: true
    }
  },

  methods: {
    initializeD3Graph() {
      console.log('Initializing D3 Graph with container');

      const container = document.getElementById('d3-graph-container');
      if (!container) {
        console.error('Container element #d3-graph-container not found!');
        return;
      }

      // Get container dimensions
      const { width, height } = container.getBoundingClientRect();
      console.log('Container dimensions:', width, 'x', height);

      // Create D3 Graph instance
      this.graph = new GraphRenderer(container, {
        width: width || window.innerWidth,
        height: height || window.innerHeight,
        padding: 50,
        nodeRadius: 25,
        onNodeClick: (node, event) => {
          // Emit node click event to parent
          this.$emit('node-clicked', node, event);
        }
      });

      console.log('D3 Graph initialized successfully');

      // Load real data if available
      if (this.graphData && this.graphData.vertices && Object.keys(this.graphData.vertices).length > 0) {
        console.log('Real data available, loading graph');
        this.updateGraph(this.graphData);
      }
    },

    updateGraph(data) {
      if (!this.graph || !data || !data.vertices || !data.edges) {
        console.log('Cannot update graph: missing graph instance or graph data');
        return;
      }

      console.log(`Updating graph with ${Object.keys(data.vertices).length} nodes and ${data.edges.length} edges`);

      // Classify nodes as public or private
      const publicNodes = [];
      const privateNodes = [];

      Object.entries(data.vertices).forEach(([id, vertex]) => {
        const isPublic = vertex.public_ip === true || vertex.public_ip === 'true';
        if (isPublic) {
          publicNodes.push({ id, vertex });
        } else {
          privateNodes.push({ id, vertex });
        }
      });

      console.log(`Classified nodes: ${privateNodes.length} private, ${publicNodes.length} public`);

      // Group private nodes by cluster first, then by app_name
      const clusterGroups = {};
      privateNodes.forEach(({ id, vertex }) => {
        const cluster = vertex.cluster || 'unknown';
        const appName = vertex.app_name || 'unknown-app';
        
        if (!clusterGroups[cluster]) {
          clusterGroups[cluster] = {};
        }
        if (!clusterGroups[cluster][appName]) {
          clusterGroups[cluster][appName] = [];
        }
        clusterGroups[cluster][appName].push({ id, vertex });
      });

      const clusterCount = Object.keys(clusterGroups).length;
      const totalApps = Object.values(clusterGroups).reduce((total, cluster) => total + Object.keys(cluster).length, 0);
      console.log(`Found ${clusterCount} clusters with ${totalApps} total application groups`);

      // Transform into vertices/edges format for GraphRenderer
      const vertices = {};
      const edges = [];

      // Create private network group if we have private nodes
      if (privateNodes.length > 0) {
        vertices['private-network'] = {
          label: `Private Network (${clusterCount} clusters, ${totalApps} apps)`,
          type: 'group',
          parentId: null,
          fill: '#f0f0f0',
          stroke: '#888'
        };
      }

      // Create cluster groups within private network
      Object.entries(clusterGroups).forEach(([clusterName, clusterApps]) => {
        const clusterGroupId = `cluster-${clusterName}`;
        const appCount = Object.keys(clusterApps).length;
        
        vertices[clusterGroupId] = {
          label: `Cluster: ${clusterName} (${appCount} apps)`,
          type: 'group',
          parentId: 'private-network',
          fill: '#E8F4FD',
          stroke: '#5B8FF9'
        };

        // Create application groups within clusters
        Object.entries(clusterApps).forEach(([appName, appNodes]) => {
          const appGroupId = `app-${clusterName}-${appName}`;
          
          vertices[appGroupId] = {
            label: `App: ${appName} (${appNodes.length} nodes)`,
            type: 'group',
            parentId: clusterGroupId,
            fill: '#FFE6CC',
            stroke: '#FF9933'
          };

          // Add nodes to their application groups
          appNodes.forEach(({ id, vertex }) => {
            vertices[id] = {
              ...vertex,  // Include all original vertex data at root level
              parentId: appGroupId,
              fill: this.getNodeColor(vertex.type)
            };
          });
        });
      });

      // Add public nodes (no parent)
      publicNodes.forEach(({ id, vertex }) => {
        vertices[id] = {
          ...vertex,  // Include all original vertex data at root level
          parentId: null,
          fill: this.getNodeColor(vertex.type)
        };
      });

      // Transform edges
      data.edges.forEach((edge) => {
        edges.push({
          source: edge.start_node,
          target: edge.end_node
        });
      });

      const graphData = { vertices, edges };
      
      console.log(`Setting D3 graph data: ${Object.keys(vertices).length} vertices, ${edges.length} edges`);
      
      // Set data on D3 graph
      this.graph.setData(graphData);

      // Emit rendering complete
      this.$emit('rendering-complete', {
        nodeCount: Object.keys(vertices).filter(id => vertices[id].type === 'node').length,
        linkCount: edges.length
      });
    },

    getNodeColor(type) {
      return this.nodeColors[type] || '#999';
    },

    // Public methods for parent component
    zoomIn() {
      if (this.graph) {
        this.graph.zoomIn();
      }
    },

    zoomOut() {
      if (this.graph) {
        this.graph.zoomOut();
      }
    },

    resetView() {
      if (this.graph) {
        this.graph.resetView();
      }
    },

    resetNodePositions() {
      // Re-render with fresh layout
      if (this.graph && this.graphData) {
        this.updateGraph(this.graphData);
      }
    },

    // Node highlighting methods
    selectNodeById(nodeId, appendToSelection = false) {
      if (this.graph && this.graph.selectNodeById) {
        this.graph.selectNodeById(nodeId, appendToSelection);
      }
    },

    clearHighlight() {
      if (this.graph && this.graph.clearHighlight) {
        this.graph.clearHighlight();
      }
    }
  }
};
</script>

<style>
#d3-graph-container {
  width: 100vw;
  height: 100vh;
  background-color: #f8f9fa;
  border: 1px solid #ccc;
}
</style>