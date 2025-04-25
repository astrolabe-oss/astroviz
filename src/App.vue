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
        <h3>Node: <span class="node-type-header-badge" :style="{ backgroundColor: getNodeTypeColor(selectedNode.type) }">{{ selectedNode.type }}</span></h3>
        <button class="close-button" @click="selectedNode = null">×</button>

        <!-- Node Main Properties Section -->
        <div class="detail-section">
          <div class="node-main-properties">
            <div class="important-property">
              <label>App:</label>
              <span>{{ selectedNode.app_name || 'Unknown' }}</span>
            </div>

            <div class="important-property">
              <label>Name:</label>
              <span>{{ selectedNode.name || 'Unknown' }}</span>
            </div>

            <div class="important-property">
              <label>Address:</label>
              <span>{{ selectedNode.address || 'Unknown' }}</span>
            </div>
          </div>
        </div>

        <!-- Node Other Properties Section -->
        <div class="detail-section">
          <h4>Other Properties</h4>
          <div class="node-properties">
            <div v-for="(value, key) in filteredNodeProperties" :key="key" class="property">
              <strong>{{ key }}:</strong> {{ value }}
            </div>
          </div>
        </div>

        <!-- Node Outgoing Relationships Section -->
        <div class="detail-section" v-if="outgoingRelationships.length > 0">
          <h4>Outgoing Connections</h4>
          <div class="relationships-container">
            <div v-for="(group, index) in groupedOutgoingRelationships" :key="index" class="relationship-group">
              <h5>{{ group.type }}</h5>
              <ul class="relationship-list">
                <li v-for="(rel, relIndex) in group.relationships" :key="relIndex">
                  <span class="node-type-badge" :style="{ backgroundColor: getNodeTypeColor(rel.nodeType) }">
                    {{ rel.nodeType }}
                  </span>
                  {{ rel.nodeName }}
                </li>
              </ul>
            </div>
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
      selectedNode: null,

      // Node type colors (matching D3NetworkGraph component)
      nodeTypeColors: {
        'Application': '#F9696E',
        'Deployment': '#F2A3B3',
        'Compute': '#5DCAD1',
        'Resource': '#74B56D',
        'TrafficController': '#4A98E3',
        'InternetIP': '#E0E0E0',
      }
    };
  },

  computed: {
    /**
     * Get filtered graph data based on current filters
     */
    filteredGraphData() {
      // Use JSON.parse(JSON.stringify()) to avoid Vue reactivity tracking
      // This prevents the infinite loop issue
      console.log("APP: Computing filteredGraphData", JSON.parse(JSON.stringify(this.filters)));

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

      // Return a new object to ensure proper reactivity
      return {
        vertices: filteredVertices,
        edges: filteredEdges
      };
    },

    /**
     * Get formatted connection info string
     */
    connectionInfo() {
      const { host, port, database } = config.neo4j;
      return `${host}:${port}${database ? ` (${database})` : ''}`;
    },

    /**
     * Get all relationships for the selected node
     */
    /**
     * Get filtered node properties excluding primary properties
     * that are already shown separately
     */
    filteredNodeProperties() {
      if (!this.selectedNode) return {};

      const result = {};
      const excludedKeys = ['type', 'app_name', 'name', 'address'];

      Object.entries(this.selectedNode).forEach(([key, value]) => {
        if (!excludedKeys.includes(key)) {
          result[key] = value;
        }
      });

      return result;
    },

    /**
     * Get all relationships for the selected node
     */
    nodeRelationships() {
      if (!this.selectedNode || !this.graphData.edges) {
        return [];
      }

      const nodeId = this.findNodeIdByProperties(this.selectedNode);
      if (!nodeId) return [];

      // Find both outgoing and incoming edges
      const relationships = this.graphData.edges.filter(edge =>
          edge.start_node === nodeId || edge.end_node === nodeId
      );

      // Enrich edges with node details
      return relationships.map(edge => {
        const isOutgoing = edge.start_node === nodeId;
        const otherNodeId = isOutgoing ? edge.end_node : edge.start_node;
        const otherNode = this.graphData.vertices[otherNodeId];

        return {
          type: edge.type,
          direction: isOutgoing ? 'outgoing' : 'incoming',
          nodeId: otherNodeId,
          nodeName: this.getNodeDisplayName(otherNode),
          nodeType: otherNode.type,
          properties: edge.properties || {}
        };
      });
    },

    /**
     * Get only outgoing relationships
     */
    outgoingRelationships() {
      return this.nodeRelationships.filter(rel => rel.direction === 'outgoing');
    },

    /**
     * Get outgoing relationships grouped by type
     */
    groupedOutgoingRelationships() {
      if (!this.outgoingRelationships.length) return [];

      // Create an object to hold the grouped relationships
      const groupedByType = {};

      this.outgoingRelationships.forEach(rel => {
        const groupKey = rel.type;

        if (!groupedByType[groupKey]) {
          groupedByType[groupKey] = {
            type: groupKey,
            relationships: []
          };
        }

        groupedByType[groupKey].relationships.push(rel);
      });

      // Convert to array and sort alphabetically by relationship type
      return Object.values(groupedByType).sort((a, b) => a.type.localeCompare(b.type));
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
    },

    /**
     * Get display name for a node
     * @param {Object} node Node data
     * @returns {string} Display name
     */
    getNodeDisplayName(node) {
      if (!node) return 'Unknown';

      if (node.name) return node.name;
      if (node.type === 'InternetIP' && node.address) return node.address;
      if (node.app_name) return `${node.type}: ${node.app_name}`;
      if (node.address) return `${node.type}: ${node.address}`;

      return `${node.type} node`;
    },

    /**
     * Find node ID by comparing properties with selectedNode
     * @param {Object} nodeProps Node properties to find
     * @returns {string|null} Node ID if found, null otherwise
     */
    findNodeIdByProperties(nodeProps) {
      if (!nodeProps) return null;

      // If the node has type and unique identifiers, we can look for it
      for (const [id, vertex] of Object.entries(this.graphData.vertices)) {
        // Compare type and check if we match key properties
        if (vertex.type === nodeProps.type) {
          // For different node types, check their common identifiers
          if (
              (nodeProps.name && vertex.name === nodeProps.name) ||
              (nodeProps.address && vertex.address === nodeProps.address) ||
              (nodeProps.app_name && vertex.app_name === nodeProps.app_name)
          ) {
            return id;
          }
        }
      }

      return null;
    },

    /**
     * Get color for node type badge
     * @param {string} nodeType Type of the node
     * @returns {string} CSS color
     */
    getNodeTypeColor(nodeType) {
      return this.nodeTypeColors[nodeType] || '#CCCCCC';
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
  width: 350px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 15px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  max-height: 70vh;
  overflow-y: auto;
  z-index: 5;
}

.node-type-header-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 14px;
  font-weight: bold;
  color: white;
  margin-left: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.node-title-label {
  font-weight: normal;
}

.node-details h3 {
  margin-top: 0;
  padding-right: 25px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
  text-align: left;
  display: flex;
  align-items: center;
}

.node-details h3 .node-title-label {
  margin-left: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
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

.detail-section {
  margin-bottom: 15px;
}

.detail-section h4 {
  margin-top: 10px;
  margin-bottom: 10px;
  font-size: 16px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
}

.node-main-properties {
  margin-bottom: 15px;
  background-color: #f5f7fa;
  padding: 15px;
  border-radius: 5px;
  border-left: 4px solid #4A98E3;
}

.node-type-header {
  margin-bottom: 12px;
  text-align: center;
}

.node-type-large {
  display: inline-block;
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  color: white;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.important-property {
  display: flex;
  margin-bottom: 8px;
  align-items: center;
}

.important-property label {
  font-weight: bold;
  min-width: 80px;
  color: #555;
}

.important-property span {
  font-size: 15px;
}

.node-properties {
  margin-top: 10px;
  max-height: 200px;
  overflow-y: auto;
  font-size: 13px;
}

.property {
  margin-bottom: 5px;
  word-break: break-word;
  font-size: 13px;
  color: #555;
}

.relationships-container {
  margin-top: 10px;
}

.relationship-group {
  margin-bottom: 15px;
  padding: 8px;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.relationship-group h5 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 14px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
}

.relationship-list {
  list-style-type: none;
  padding-left: 5px;
  margin: 0;
}

.relationship-list li {
  margin-bottom: 7px;
  display: flex;
  align-items: center;
  font-size: 13px;
}

.node-type-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  margin-right: 8px;
  font-size: 11px;
  font-weight: bold;
  color: white;
  white-space: nowrap;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
}
</style>