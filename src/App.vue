// src/App.vue
<template>
  <div id="app">
    <header class="header">
      <h1>Astrolabe Network Visualizer</h1>
      <div v-if="connected" class="connection-info">
        Connected to: {{ connectionInfo }}
        <button @click="disconnect" class="disconnect-button">Disconnect</button>
      </div>
      <button v-else @click="connect" class="connect-button">Connect to Neo4j</button>
    </header>

    <div v-if="connectionError" class="error-banner">
      <p>{{ connectionError }}</p>
      <button @click="connect" class="retry-button">Retry Connection</button>
    </div>

    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-status">
        <p class="loading-title">Loading Data from Neo4j</p>
        <p class="loading-detail">{{ loadingStatus }}</p>
        <div v-if="loadingProgress > 0" class="progress-bar">
          <div class="progress-fill" :style="{width: loadingProgress + '%'}"></div>
        </div>
      </div>
    </div>

    <main v-if="connected" class="main-content">
      <FilterBar
          :unique-values="uniqueValues"
          :view-mode.sync="viewMode"
          :filters.sync="filters"
      />

      <D3NetworkGraph
          :graph-data="filteredGraphData"
          :view-mode="viewMode"
          @node-clicked="onNodeClicked"
      />

      <div v-if="selectedNode" class="node-details">
        <h3>Node Details</h3>
        <button class="close-button" @click="selectedNode = null">×</button>
        <div class="node-properties">
          <div v-for="(value, key) in selectedNode" :key="key" class="property">
            <strong>{{ key }}:</strong> {{ value }}
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import FilterBar from '@/components/FilterBar.vue';
import D3NetworkGraph from '@/components/D3NetworkGraph.vue';
import neo4jService from '@/services/neo4jService';
import config from '@/config';

export default {
  name: 'App',

  components: {
    FilterBar,
    D3NetworkGraph
  },

  data() {
    return {
      // Connection state
      connected: false,
      connecting: false,
      connectionError: null,
      loading: false,

      // Loading status
      loadingStatus: "Initializing...",
      loadingProgress: 0,

      // Graph data
      graphData: {
        vertices: {},
        edges: []
      },
      uniqueValues: {
        appNames: [],
        providers: [],
        protocolMuxes: [],
        addresses: []
      },

      // Visualization state
      viewMode: 'detailed',
      filters: {
        appName: '',
        provider: '',
        protocolMux: '',
        address: ''
      },
      selectedNode: null
    };
  },

  computed: {
    /**
     * Get filtered graph data based on current filters
     */
    filteredGraphData() {
      console.log("APP: Computing filteredGraphData", this.filters);

      // If no filters are applied, return the full graph data
      if (!this.filters.appName && !this.filters.provider &&
          !this.filters.protocolMux && !this.filters.address) {
        return this.graphData;
      }

      // Filter vertices
      const filteredVertices = {};
      Object.entries(this.graphData.vertices).forEach(([id, vertex]) => {
        if (
            (!this.filters.appName || vertex.app_name === this.filters.appName) &&
            (!this.filters.provider || vertex.provider === this.filters.provider) &&
            (!this.filters.protocolMux || vertex.protocol_multiplexor === this.filters.protocolMux) &&
            (!this.filters.address || vertex.address === this.filters.address)
        ) {
          filteredVertices[id] = vertex;
        }
      });

      // Get IDs of included nodes
      const includedNodeIds = new Set(Object.keys(filteredVertices));

      // Filter edges to only include those between visible nodes
      const filteredEdges = this.graphData.edges.filter(edge =>
          includedNodeIds.has(edge.start_node) && includedNodeIds.has(edge.end_node)
      );

      console.log(`APP: Filtered from ${Object.keys(this.graphData.vertices).length} to ${Object.keys(filteredVertices).length} vertices`);
      return { vertices: filteredVertices, edges: filteredEdges };
    },

    /**
     * Get formatted connection info string
     */
    connectionInfo() {
      const { host, port, database } = config.neo4j;
      return `${host}:${port}${database ? ` (${database})` : ''}`;
    }
  },

  mounted() {
    console.log("APP: Component mounted, connecting automatically");
    // Auto-connect when the component is mounted
    this.connect();
  },

  methods: {
    /**
     * Connect to Neo4j database
     */
    async connect() {
      console.log("APP: Starting connection process");
      this.connecting = true;
      this.connectionError = null;
      this.loading = true;
      this.loadingStatus = "Connecting to Neo4j...";
      this.loadingProgress = 5;

      try {
        console.log("APP: Calling neo4jService.connect()");
        await neo4jService.connect();
        console.log("APP: Connection successful");
        this.connected = true;
        console.log("APP: Starting data fetch");
        await this.fetchGraphData();
      } catch (error) {
        console.error("APP: Connection error", error);
        this.connectionError = `Failed to connect: ${error.message}`;
        this.connected = false;
      } finally {
        console.log("APP: Connection process completed");
        this.connecting = false;
        this.loading = false;
      }
    },

    /**
     * Disconnect from Neo4j database
     */
    disconnect() {
      neo4jService.disconnect();
      this.connected = false;
      this.graphData = { vertices: {}, edges: [] };
      this.uniqueValues = {
        appNames: [],
        providers: [],
        protocolMuxes: [],
        addresses: []
      };
      this.selectedNode = null;
    },

    /**
     * Fetch graph data from Neo4j
     */
    async fetchGraphData() {
      console.log("APP: Starting fetchGraphData");
      this.loading = true;
      this.loadingStatus = "Connecting to database...";
      this.loadingProgress = 5;

      try {
        // Fetch graph data
        console.log("APP: Preparing to fetch data");
        this.loadingStatus = "Fetching graph data...";
        this.loadingProgress = 10;
        const graphData = await neo4jService.fetchGraphData(
            (status, progress) => {
              console.log(`APP: Progress update - ${status} (${progress}%)`);
              this.loadingStatus = status;
              this.loadingProgress = progress;
            }
        );

        console.log("APP: Data fetch complete, processing data");
        this.loadingStatus = "Processing graph data...";
        this.loadingProgress = 70;
        this.graphData = graphData;

        // Extract unique values for filters
        console.log("APP: Extracting filter values");
        this.loadingStatus = "Extracting filter values...";
        this.loadingProgress = 80;
        const appNames = new Set();
        const providers = new Set();
        const protocolMuxes = new Set();
        const addresses = new Set();

        console.log(`APP: Processing ${Object.keys(this.graphData.vertices).length} vertices for filter values`);
        Object.values(this.graphData.vertices).forEach(vertex => {
          if (vertex.app_name) appNames.add(vertex.app_name);
          if (vertex.provider) providers.add(vertex.provider);
          if (vertex.protocol_multiplexor) protocolMuxes.add(vertex.protocol_multiplexor);
          if (vertex.address) addresses.add(vertex.address);
        });

        this.uniqueValues = {
          appNames: Array.from(appNames).sort(),
          providers: Array.from(providers).sort(),
          protocolMuxes: Array.from(protocolMuxes).sort(),
          addresses: Array.from(addresses).sort()
        };

        console.log("APP: Filter values extracted", this.uniqueValues);
        this.loadingStatus = "Preparing visualization...";
        this.loadingProgress = 90;

        // Delay slightly to allow UI to update before rendering the graph
        // which can be CPU intensive
        console.log("APP: Scheduling visualization completion");
        setTimeout(() => {
          console.log("APP: Loading complete");
          this.loadingStatus = "Complete!";
          this.loadingProgress = 100;
          this.loading = false;
        }, 500);
      } catch (error) {
        console.error('APP: Error fetching graph data:', error);
        this.connectionError = `Failed to fetch data: ${error.message}`;
        this.connected = false;
        neo4jService.disconnect();
        this.loading = false;
      }
    },

    /**
     * Handle node click event
     * @param {Object} node The clicked node data
     */
    onNodeClicked(node) {
      this.selectedNode = node;
    }
  }
};
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin: 0;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #ddd;
  padding-bottom: 10px;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.connect-button, .disconnect-button, .retry-button {
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  border: none;
  transition: background-color 0.2s;
}

.connect-button {
  background-color: #4CAF50;
  color: white;
}

.connect-button:hover {
  background-color: #45a049;
}

.disconnect-button {
  background-color: #f44336;
  color: white;
}

.disconnect-button:hover {
  background-color: #d32f2f;
}

.retry-button {
  background-color: #2196F3;
  color: white;
}

.retry-button:hover {
  background-color: #1976D2;
}

.error-banner {
  background-color: #ffebee;
  border: 1px solid #ffcdd2;
  border-radius: 4px;
  padding: 10px 15px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-banner p {
  color: #c62828;
  margin: 0;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 2s linear infinite;
  margin-bottom: 15px;
}

.loading-status {
  background-color: white;
  padding: 20px;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  width: 80%;
  text-align: center;
}

.loading-title {
  font-size: 18px;
  font-weight: bold;
  margin-top: 0;
  margin-bottom: 10px;
}

.loading-detail {
  margin-bottom: 15px;
  color: #666;
}

.progress-bar {
  width: 100%;
  height: 10px;
  background-color: #f3f3f3;
  border-radius: 5px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #4CAF50;
  transition: width 0.3s ease;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.main-content {
  position: relative;
  min-height: 80vh;
}

.node-details {
  position: absolute;
  right: 20px;
  top: 70px;
  width: 300px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 15px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  max-height: 70vh;
  overflow-y: auto;
  z-index: 5;
}

.node-details h3 {
  margin-top: 0;
  padding-right: 25px;
}

.close-button {
  position: absolute;
  top: 15px;
  right: 15px;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
}

.node-properties {
  margin-top: 10px;
}

.property {
  margin-bottom: 5px;
  word-break: break-word;
}
</style>