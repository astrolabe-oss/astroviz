<template>
  <div class="network-graph">
    <div class="rendering-status" v-if="isRendering">
      <div class="spinner"></div>
      <span>Rendering {{ nodeCount }} nodes and {{ edgeCount }} connections...</span>
    </div>
    <div id="visualization" ref="visualization"></div>
    <div class="graph-stats" v-if="showStats">
      <div>Nodes: {{ nodeCount }}</div>
      <div>Connections: {{ edgeCount }}</div>
    </div>
  </div>
</template>

<script>
// Import both packages separately
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';

export default {
  name: 'NetworkGraph',

  props: {
    // Graph data from Neo4j
    graphData: {
      type: Object,
      required: true,
      default: () => ({ vertices: {}, edges: [] })
    },
    // Current view mode: 'detailed' or 'application'
    viewMode: {
      type: String,
      required: true,
      default: 'detailed'
    }
  },

  data() {
    return {
      network: null,
      options: {
        physics: {
          stabilization: {
            enabled: true,
            iterations: 1000,
            updateInterval: 50
          },
          barnesHut: {
            gravitationalConstant: -2000,
            springConstant: 0.04,
            springLength: 95
          }
        },
        edges: {
          smooth: {
            type: 'continuous',
            forceDirection: 'none'
          }
        },
        groups: {
          application: { color: { background: '#6DB33F', border: '#5CA12F' } },
          deployment: { color: { background: '#1E88E5', border: '#1976D2' } },
          compute: { color: { background: '#FFA726', border: '#FB8C00' } },
          resource: { color: { background: '#7E57C2', border: '#673AB7' } },
          trafficcontroller: { color: { background: '#26A69A', border: '#00897B' } },
          internetip: { color: { background: '#EC407A', border: '#D81B60' } }
        }
      },
      isRendering: false,
      stabilizationProgress: 0,
      nodeCount: 0,
      edgeCount: 0,
      showStats: false,
      // Keep track of dataset instances
      nodesDataset: null,
      edgesDataset: null
    };
  },

  watch: {
    // Update visualization when graph data or view mode changes
    graphData: {
      handler(newVal) {
        console.log("NETWORK: Graph data changed");
        try {
          if (newVal && newVal.vertices && Object.keys(newVal.vertices).length > 0) {
            this.updateVisualization();
          }
        } catch (error) {
          console.error("NETWORK: Error in graphData watcher", error);
        }
      },
      deep: true
    },
    viewMode() {
      console.log("NETWORK: View mode changed");
      try {
        if (this.graphData && this.graphData.vertices &&
            Object.keys(this.graphData.vertices).length > 0) {
          this.updateVisualization();
        }
      } catch (error) {
        console.error("NETWORK: Error in viewMode watcher", error);
      }
    }
  },

  mounted() {
    // Initialize network visualization
    try {
      this.initNetwork();

      // Update with initial data if available
      if (this.graphData.vertices && Object.keys(this.graphData.vertices).length > 0) {
        this.updateVisualization();
      }

      // Handle window resize
      window.addEventListener('resize', this.onResize);
    } catch (error) {
      console.error("NETWORK: Error in mounted", error);
    }
  },

  beforeDestroy() {
    // Clean up
    window.removeEventListener('resize', this.onResize);

    if (this.network) {
      this.network.destroy();
    }
  },

  methods: {
    /**
     * Initialize the network visualization
     */
    initNetwork() {
      try {
        console.log("NETWORK: Initializing network");
        const container = this.$refs.visualization;

        // Create empty datasets
        this.nodesDataset = new DataSet([]);
        this.edgesDataset = new DataSet([]);

        // Create network with empty data
        this.network = new Network(
            container,
            {
              nodes: this.nodesDataset,
              edges: this.edgesDataset
            },
            this.options
        );

        // Add event listeners
        this.network.on('click', this.onNodeClick);

        // Add stabilization events manually
        this.network.on('stabilizationProgress', (params) => {
          console.log("NETWORK: Stabilization progress", params);
          this.stabilizationProgress = Math.round((params.iterations / params.total) * 100);
        });

        this.network.on('stabilizationIterationsDone', () => {
          console.log("NETWORK: Stabilization complete");
          this.isRendering = false;
          this.stabilizationProgress = 100;
          setTimeout(() => {
            this.showStats = true;
          }, 500);
        });

        console.log("NETWORK: Network initialized");
      } catch (error) {
        console.error("NETWORK: Error initializing network", error);
        throw error;
      }
    },

    /**
     * Update the visualization based on current graph data and view mode
     */
    updateVisualization() {
      try {
        console.log("NETWORK: Updating visualization");
        if (!this.network || !this.graphData.vertices || Object.keys(this.graphData.vertices).length === 0) {
          console.log("NETWORK: Nothing to visualize");
          return;
        }

        // Reset stats
        this.showStats = false;
        this.isRendering = true;
        this.stabilizationProgress = 0;

        let visData;

        // Transform data based on view mode
        if (this.viewMode === 'application') {
          visData = this.transformToApplicationView(this.graphData);
        } else {
          visData = this.transformToDetailedView(this.graphData);
        }

        // Update node and edge counts
        this.nodeCount = visData.nodes.length;
        this.edgeCount = visData.edges.length;

        console.log("NETWORK: Setting network data", this.nodeCount, "nodes,", this.edgeCount, "edges");

        // Update datasets
        this.nodesDataset.clear();
        this.edgesDataset.clear();

        // Add new data to datasets
        this.nodesDataset.add(visData.nodes);
        this.edgesDataset.add(visData.edges);

        // If we have a lot of nodes, perform a fit after rendering
        if (this.nodeCount > 100) {
          console.log("NETWORK: Scheduling fit for large graph");
          setTimeout(() => {
            this.network.fit({
              animation: {
                duration: 1000,
                easingFunction: 'easeInOutQuad'
              }
            });
          }, 1500);
        }

        console.log("NETWORK: Visualization updated");
      } catch (error) {
        console.error("NETWORK: Error updating visualization", error);
        throw error;
      }
    },

    /**
     * Transform graph data to detailed view
     * @param {Object} graphData The filtered graph data
     * @returns {Object} Transformed data for visualization
     */
    transformToDetailedView(graphData) {
      console.log("NETWORK: transformToDetailedView called");

      // Create nodes for visualization
      const nodes = [];
      Object.entries(graphData.vertices).forEach(([id, vertex]) => {
        nodes.push({
          id,
          label: this.getNodeLabel(vertex),
          group: vertex.type.toLowerCase()
        });
      });

      // Create edges for visualization
      const edges = [];
      graphData.edges.forEach(edge => {
        edges.push({
          from: edge.start_node,
          to: edge.end_node,
          label: edge.type,
          arrows: 'to'
        });
      });

      console.log(`NETWORK: Detailed view has ${nodes.length} nodes and ${edges.length} edges`);
      return { nodes, edges };
    },

    /**
     * Transform graph data to application level view
     * @param {Object} graphData The filtered graph data
     * @returns {Object} Transformed data for visualization
     */
    transformToApplicationView(graphData) {
      console.log("NETWORK: transformToApplicationView called");

      const appNodes = {};
      const deploymentToAppMap = {};
      const computeToAppMap = {};

      // First pass - identify all Applications and create vis.js nodes
      Object.entries(graphData.vertices).forEach(([id, vertex]) => {
        if (vertex.type === 'Application') {
          appNodes[id] = {
            id,
            label: vertex.name || `App: ${vertex.app_name || id}`,
            group: 'application'
          };
        }
      });

      // Second pass - find deployment-to-application relationships
      graphData.edges.forEach(edge => {
        if (edge.type === 'IMPLEMENTS') {
          deploymentToAppMap[edge.start_node] = edge.end_node;
        }
      });

      // Third pass - find compute-to-deployment relationships
      graphData.edges.forEach(edge => {
        if (edge.type === 'MEMBER_OF') {
          const deploymentId = edge.end_node;
          const appId = deploymentToAppMap[deploymentId];
          if (appId) {
            computeToAppMap[edge.start_node] = appId;
          }
        }
      });

      // Fourth pass - create app-to-app connections based on compute connections
      const appConnections = {};
      graphData.edges.forEach(edge => {
        if (edge.type === 'CALLS') {
          const sourceAppId = computeToAppMap[edge.start_node];
          const targetAppId = computeToAppMap[edge.end_node];

          if (sourceAppId && targetAppId && sourceAppId !== targetAppId) {
            const connKey = `${sourceAppId}-${targetAppId}`;
            appConnections[connKey] = {
              from: sourceAppId,
              to: targetAppId,
              arrows: 'to',
              label: 'CALLS'
            };
          }
        }
      });

      const nodes = Object.values(appNodes);
      const edges = Object.values(appConnections);

      console.log(`NETWORK: Application view has ${nodes.length} nodes and ${edges.length} edges`);
      return { nodes, edges };
    },

    /**
     * Create a meaningful label for a node based on its type and properties
     * @param {Object} vertex The vertex data
     * @returns {string} A label for display
     */
    getNodeLabel(vertex) {
      const type = vertex.type.toLowerCase();

      if (type === 'application') {
        return vertex.name || `App: ${vertex.app_name || 'Unknown'}`;
      }
      if (type === 'deployment') {
        return vertex.name || `Deploy: ${vertex.app_name || 'Unknown'}`;
      }
      if (type === 'compute') {
        return `${vertex.name || 'Compute'}${vertex.address ? ` (${vertex.address})` : ''}`;
      }
      if (type === 'resource') {
        return `${vertex.name || 'Resource'}${vertex.address ? ` (${vertex.address})` : ''}`;
      }
      if (type === 'trafficcontroller') {
        return `${vertex.name || 'Traffic'}${vertex.address ? ` (${vertex.address})` : ''}`;
      }

      // Default
      return vertex.name || vertex.type;
    },

    /**
     * Handle node click event
     * @param {Object} params Event parameters
     */
    onNodeClick(params) {
      if (params.nodes && params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = this.graphData.vertices[nodeId];

        if (node) {
          // Emit node clicked event
          this.$emit('node-clicked', node);
        }
      }
    },

    /**
     * Handle window resize
     */
    onResize() {
      if (this.network) {
        this.network.fit();
      }
    }
  }
};
</script>

<style scoped>
.network-graph {
  width: 100%;
  height: 100%;
  position: relative;
}

#visualization {
  width: 100%;
  height: 75vh;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f9f9f9;
}

.rendering-status {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 10px 15px;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  z-index: 10;
  font-size: 14px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 10px;
}

.graph-stats {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 8px 12px;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  font-size: 12px;
  z-index: 10;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>