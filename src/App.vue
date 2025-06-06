<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

// src/App.vue - updated to handle node selection from details panel
<template>
  <div id="app">
    <ConnectionError
        :error="connectionError"
        @retry="connect"
    />

    <LoadingOverlay
        :loading="loading"
        :status="loadingStatus"
        :progress="loadingProgress"
    />

    <div class="header-row">
      <div class="logo-container">
        <ConnectionHeader
            :connected="connected"
            @connect="connect"
            @disconnect="disconnect"
        />
      </div>
      
      <div class="filter-container">
        <div class="view-mode-wrapper">
          <ViewModeSelector v-model="viewMode" />
        </div>
        <FilterControls 
          :uniqueValues="uniqueValues" 
          :value="filters" 
          @input="updateFilters" 
        />
      </div>
      
      <div class="connect-container" v-if="!connected">
        <button @click="connect" class="connect-button">Connect to Neo4j</button>
      </div>
    </div>

    <main v-if="connected" class="main-content">
      <div class="connection-overlay">
        <div class="connection-info">
          Connected to: {{ connectionInfo }}
          <button @click="disconnect" class="disconnect-button">Disconnect</button>
          <button @click="refreshGraphData" class="refresh-button" title="Refresh graph data">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/>
            </svg>
          </button>
        </div>
      </div>
      
      <D3NetworkGraph
          ref="networkGraph"
          :graph-data="filteredGraphData"
          :view-mode="viewMode"
          :highlighted-node-ids="highlightedNodeIds"
          @node-clicked="onNodeClicked"
      />

      <NodeDetails
          :node="selectedNode"
          :graph-data="filteredGraphData"
          :view-mode="viewMode"
          :raw-graph-data="rawGraphData"
          @close="selectedNode = null"
          @select-node="onSelectConnectedNode"
      />
    </main>
  </div>
</template>

<script>
// Connection components
import ConnectionHeader from '@/components/connection/ConnectionHeader.vue';
import ConnectionError from '@/components/connection/ConnectionError.vue';
import LoadingOverlay from '@/components/connection/LoadingOverlay.vue';

// Existing components
import D3NetworkGraph from '@/components/D3NetworkGraph.vue';
import FilterControls from '@/components/filter/FilterControls.vue';
import ViewModeSelector from '@/components/filter/ViewModeSelector.vue';

// New components
import NodeDetails from '@/components/nodeDetails/NodeDetails.vue';

// Services and utilities
import neo4jService from '@/services/neo4jService';
import config from '@/config';
import { findNodeIdByProperties } from '@/utils/nodeUtils';

export default {
  name: 'App',

  components: {
    ConnectionHeader,
    ConnectionError,
    LoadingOverlay,
    FilterControls,
    ViewModeSelector,
    D3NetworkGraph,
    NodeDetails
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
      rawGraphData: {
        vertices: {},
        edges: []
      },
      aggregatedGraphData: {
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
      viewMode: localStorage.getItem('viewMode') || 'detailed',
      filters: {
        appName: '',
        provider: '',
        protocolMux: '',
        address: '',
        publicIp: ''
      },
      selectedNode: null,
      selectedNodes: [] // Array to track multiple selected nodes
    };
  },

  watch: {
    /**
     * Watch for changes in viewMode to save to localStorage
     */
    viewMode(newValue) {
      console.log(`APP: View mode changed to ${newValue}, saving to localStorage`);
      localStorage.setItem('viewMode', newValue);
    }
  },
  
  computed: {
    /**
     * Get filtered graph data based on current filters and view mode
     */
    filteredGraphData() {
      console.log(`APP: Computing filteredGraphData with view mode: ${this.viewMode}`, JSON.parse(JSON.stringify(this.filters)));
      if (this.viewMode === 'application') {
        return this.aggregatedGraphData;
      }
      return this.rawGraphData;
    },
    
    /**
     * Get set of node IDs that match current filters
     */
    highlightedNodeIds() {
      // If no filters are applied, return empty set (no highlights)
      if (!this.filters.appName && !this.filters.provider &&
          !this.filters.protocolMux && !this.filters.address && 
          !this.filters.publicIp) {
        return new Set();
      }
    
      // Find vertices that match filters
      const matchingNodeIds = new Set();
      Object.entries(this.rawGraphData.vertices).forEach(([id, vertex]) => {
        // Handle public IP filtering - "public" means has public_ip, "private" means no public_ip
        const publicIpMatch = !this.filters.publicIp || 
          (this.filters.publicIp === 'public' && vertex.public_ip) || 
          (this.filters.publicIp === 'private' && !vertex.public_ip);
        
        if (
            (!this.filters.appName || vertex.app_name === this.filters.appName) &&
            (!this.filters.provider || vertex.provider === this.filters.provider) &&
            (!this.filters.protocolMux || vertex.protocol_multiplexor === this.filters.protocolMux) &&
            (!this.filters.address || vertex.address === this.filters.address) &&
            publicIpMatch
        ) {
          matchingNodeIds.add(id);
        }
      });
    
      console.log(`APP: Highlighted ${matchingNodeIds.size} of ${Object.keys(this.rawGraphData.vertices).length} vertices`);
      return matchingNodeIds;
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
     * Fetch graph data from Neo4j service - consolidated method
     * @param {Function} statusCallback Optional callback for status updates
     * @param {Function} progressCallback Optional callback for progress updates
     * @returns {Promise<Object>} Promise resolving to raw graph data
     */
    async fetchGraphFromNeo4j(statusCallback, progressCallback) {
      console.log(`APP: Fetching graph data from Neo4j service`);
      const rawData = await neo4jService.fetchGraphData((status, progress) => {
        // Update the component's loading status and progress
        this.loadingStatus = status;
        this.loadingProgress = progress;
        
        // Call the callbacks if provided
        if (statusCallback && typeof statusCallback === 'function') {
          statusCallback(status);
        }
        if (progressCallback && typeof progressCallback === 'function') {
          progressCallback(progress);
        }
      });
      
      // Always generate aggregated data regardless of view mode
      const aggregatedData = neo4jService.aggregateDataForApplicationView(rawData);
      
      console.log(`APP: Fetched raw data with ${Object.keys(rawData.vertices).length} nodes and ${rawData.edges.length} edges`);
      console.log(`APP: Generated aggregated data with ${Object.keys(aggregatedData.vertices).length} nodes and ${aggregatedData.edges.length} edges`);
      
      // Update both data stores
      this.rawGraphData = rawData;
      this.aggregatedGraphData = aggregatedData;
      
      return rawData;
    },
    
    /**
     * Refresh graph data from Neo4j
     */
    async refreshGraphData() {
      try {
        console.log("APP: Refreshing graph data");
        this.loading = true;
        this.loadingStatus = "Refreshing graph data...";
        this.loadingProgress = 10;
        
        // Call the consolidated method to update both raw and aggregated data
        await this.fetchGraphFromNeo4j();
        
        // Hide loading state
        this.loading = false;
        
        console.log("APP: Graph data refreshed successfully");
      } catch (error) {
        console.error("Failed to refresh graph data:", error);
        this.connectionError = error.message;
        this.loading = false;
      }
    },
    
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
      this.rawGraphData = { vertices: {}, edges: [] };
      this.aggregatedGraphData = { vertices: {}, edges: [] };
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
        
        // Call the consolidated method with status logging callback
        const graphData = await this.fetchGraphFromNeo4j(
          (status) => {
            console.log(`APP: Progress update - ${status} (${this.loadingProgress}%)`);
          }
        );

        console.log("APP: Data fetch complete, processing data");
        this.loadingStatus = "Processing graph data...";
        this.loadingProgress = 70;
        // Store the graph data
        // We are not directly assigning to this.graphData as we maintain separate
        // rawGraphData and aggregatedGraphData properties
        
        // Extract unique values for filters
        console.log("APP: Extracting filter values");
        this.loadingStatus = "Extracting filter values...";
        this.loadingProgress = 80;
        const appNames = new Set();
        const providers = new Set();
        const protocolMuxes = new Set();
        const addresses = new Set();
        
        console.log(`APP: Processing ${Object.keys(this.rawGraphData.vertices).length} vertices for filter values`);
        Object.values(this.rawGraphData.vertices).forEach(vertex => {
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
     * @param {boolean} isShiftKey Whether the shift key was pressed during click
     */
    onNodeClicked(node, isShiftKey) {
      console.log("APP: Node clicked with shift key:", isShiftKey);
      
      // Always update the currently selected node for the details panel
      this.selectedNode = node;
      
      if (!this.$refs.networkGraph) {
        console.warn("APP: Network graph reference not available");
        return;
      }
      
      // Find the node ID in the graph data for visualization
      const nodeId = findNodeIdByProperties(node, this.filteredGraphData);
      if (!nodeId) {
        console.warn("APP: Could not find node ID for clicked node:", node);
        return;
      }
      
      // Multi-select handling with shift key
      if (isShiftKey) {
        // Check if this node is already selected to avoid duplicates
        const nodeAlreadySelected = this.selectedNodes.some(
          selectedNode => JSON.stringify(selectedNode) === JSON.stringify(node)
        );
        
        // If not already selected, add to the selection
        if (!nodeAlreadySelected) {
          this.selectedNodes.push(node);
          
          // Tell the graph visualization to highlight this node without clearing others
          this.$refs.networkGraph.selectNodeById(nodeId, true);
        }
      } else {
        // Regular click (no shift) - replace the selection
        this.selectedNodes = [node];
        
        // Tell the graph visualization to highlight only this node
        this.$refs.networkGraph.selectNodeById(nodeId, false);
      }
      
      console.log("APP: Selected nodes count:", this.selectedNodes.length);
    },

    /**
     * Handle selection of a connected node from the details panel
     * @param {Object} nodeData Node data to select
     * @param {boolean} isShiftKey Whether shift key was pressed (optional)
     */
    onSelectConnectedNode(nodeData, isShiftKey = false) {
      console.log("APP: Selecting connected node", nodeData, isShiftKey ? "with shift" : "");
    
      // Find the node ID in the graph data
      const nodeId = findNodeIdByProperties(nodeData, this.filteredGraphData);
    
      if (nodeId) {
        // Always update the currently selected node for the details panel
        this.selectedNode = nodeData;
        
        // Multi-select handling
        if (isShiftKey) {
          // Check if node already selected to avoid duplicates
          const nodeAlreadySelected = this.selectedNodes.some(
            selectedNode => JSON.stringify(selectedNode) === JSON.stringify(nodeData)
          );
          
          // If not already selected, add to the selection
          if (!nodeAlreadySelected) {
            this.selectedNodes.push(nodeData);
          }
        } else {
          // Regular selection - replace the selection
          this.selectedNodes = [nodeData];
        }
        
        // Tell the graph visualization to highlight this node
        if (this.$refs.networkGraph) {
          this.$refs.networkGraph.selectNodeById(nodeId, isShiftKey);
        }
      } else {
        console.warn("APP: Connected node not found in graph data", nodeData);
      }
    },
    
    /**
     * Update filters from FilterControls component
     */
    updateFilters(newFilters) {
      this.filters = { ...newFilters };
    }
  }
};
</script>

<style>
#app {
  font-family: 'Inter', 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin: 0;
  padding: 20px;
  height: calc(100% - 40px);
  min-height: calc(100vh - 40px);
}

.header-row {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
}

.logo-container {
  flex: 0 0 250px;
  background-color: #f8f9fa;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 8px 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 90px;
  overflow: visible;
  box-sizing: border-box;
}

.filter-container {
  flex: 1;
  background-color: #f8f9fa;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 6px 15px;
  overflow: hidden;
  height: 90px;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
  box-sizing: border-box;
}

.connect-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 15px;
}

.main-content {
  position: relative;
  min-height: 80vh;
  background-color: #f8f9fa;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.connection-overlay {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 100;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 8px 12px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 14px;
}

.connect-button, .disconnect-button {
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
  font-size: 12px;
  padding: 6px 10px;
}

.disconnect-button:hover {
  background-color: #d32f2f;
}

.refresh-button {
  padding: 5px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  margin-left: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  width: 28px;
}

.refresh-button:hover {
  background-color: #388e3c;
}

.refresh-button {
  padding: 5px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  margin-left: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  width: 28px;
}

.refresh-button:hover {
  background-color: #388e3c;
}

.refresh-button {
  padding: 5px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  margin-left: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  width: 28px;
}

.refresh-button:hover {
  background-color: #388e3c;
}

.view-mode-wrapper {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  margin-right: 15px;
  flex-shrink: 0;
  border-right: 1px solid #ddd;
  padding: 4px 15px 4px 5px;
  min-width: 150px;
}
</style>