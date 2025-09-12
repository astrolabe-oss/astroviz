<template>
<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->


  <div v-if="node" class="node-details">
    <h3>Node: <span class="node-type-header-badge" :style="{ backgroundColor: getNodeTypeColor(node.type) }">{{ node.type }}</span></h3>
    <button class="close-button" @click="closeDetails">×</button>

    <!-- Profile Timestamp Section -->
    <div class="detail-section">
      <div class="profile-timestamp-container">
        <div class="connections-header profile-timestamp-header">
          <h5>Last profiled: {{ node.profile_timestamp ? formattedProfileTimestamp : '&lt;Unknown&gt;' }}</h5>
        </div>
      </div>
    </div>

    <!-- Node Main Properties Section -->
    <div class="detail-section">
      <div class="node-main-properties">
        <div class="important-property">
          <label>App:</label>
          <span>{{ node.app_name || 'Unknown' }}</span>
        </div>

        <div class="important-property">
          <label>Name:</label>
          <span>{{ node.name || 'Unknown' }}</span>
        </div>

        <div class="important-property">
          <label>Address:</label>
          <span>{{ node.address || 'Unknown' }}</span>
        </div>
      </div>
    </div>


    <!-- Node Relationships Section -->
    <div class="detail-section" v-if="hasAnyRelationships">
      <!-- Connections Container -->
      <div class="connections-container">
        <div class="connections-header">
          <h5>Connections</h5>
        </div>

        <!-- Connections Tabs -->
        <div class="relationship-tabs">
          <button
              :class="['tab-button', { active: activeConnsTab === 'to' }]"
              @click="activeConnsTab = 'to'"
          >
            TO ({{ outgoingRelationships.length }})
          </button>
          <button
              :class="['tab-button', { active: activeConnsTab === 'from' }]"
              @click="activeConnsTab = 'from'"
          >
            FROM ({{ incomingRelationships.length }})
          </button>
        </div>

        <!-- TO Connections Tab -->
        <div v-if="activeConnsTab === 'to'" class="tab-content">
          <div v-if="outgoingRelationships.length === 0" class="no-connections">
            No outgoing connections
          </div>
          <div v-else>
            <div v-for="(group, index) in groupedOutgoingRelationships" :key="`out-${index}`" class="relationship-group">
              <h5>{{ group.type }}</h5>
              <ul class="relationship-list">
                <li
                    v-for="(rel, relIndex) in group.relationships"
                    :key="`conns-out-${relIndex}`"
                    class="relationship-item"
                    @click="(event) => selectNodeInGraph(rel, event.shiftKey)"
                >
                  <span class="node-type-badge" :style="{ backgroundColor: getNodeTypeColor(rel.nodeType) }">
                    {{ rel.nodeType }}
                  </span>
                  <span class="connection-details" :title="getNodeTooltip(rel)">
                    {{ formatConnectionDetails(rel) }}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- FROM Connections Tab -->
        <div v-if="activeConnsTab === 'from'" class="tab-content">
          <div v-if="incomingRelationships.length === 0" class="no-connections">
            No incoming connections
          </div>
          <div v-else>
            <div v-for="(group, index) in groupedIncomingRelationships" :key="`in-${index}`" class="relationship-group">
              <h5>{{ group.type }}</h5>
              <ul class="relationship-list">
                <li
                    v-for="(rel, relIndex) in group.relationships"
                    :key="`conns-in-${relIndex}`"
                    class="relationship-item"
                    @click="(event) => selectNodeInGraph(rel, event.shiftKey)"
                >
                  <span class="node-type-badge" :style="{ backgroundColor: getNodeTypeColor(rel.nodeType) }">
                    {{ rel.nodeType }}
                  </span>
                  <span class="connection-details" :title="getNodeTooltip(rel)">
                    {{ formatConnectionDetails(rel) }}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Node Other Properties Section -->
    <div class="detail-section" v-if="Object.keys(filteredNodeProperties).length > 0">
      <div class="connections-container properties-container">
        <div class="connections-header properties-header">
          <h5>Additional/Debug Properties</h5>
        </div>

        <div class="node-properties">
          <div v-for="(value, key) in filteredNodeProperties" :key="key" class="property">
            <strong>{{ key }}:</strong> {{ value }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getNodeTypeColor } from '@/utils/nodeUtils';
import { processNodeRelationships, groupRelationshipsByType } from '@/utils/relationshipUtils';

export default {
  name: 'NodeDetails',

  components: {
  },

  props: {
    node: {
      type: Object,
      default: null
    },
    graphData: {
      type: Object,
      required: true
    },
    // Raw graph data for additional lookups
    rawGraphData: {
      type: Object,
      required: true
    }
  },

  data() {
    return {
      activeConnsTab: 'to',   // Default to TO tab for connections
      nodeColors: {
        'Application': '#F9696E', // Red 
        'Deployment': '#F2A3B3', // Pink
        'Compute': '#5DCAD1', // Light blue 
        'Resource': '#74B56D', // Green 
        'TrafficController': '#4A98E3', // Blue
        'Public IP': '#E0E0E0', // Grey for Public IP
        'Unknown': '#F9C96E', // Orange for unknown nodes
        'Private Network': 'rgba(240, 240, 245, 0.8)',
        'Internet Boundary': '#4A98E3' // Blue color for Internet Boundary
      }
    };
  },

  computed: {
    /**
     * Format the profile timestamp in a human-readable local time format
     * Handles both millisecond and second timestamps
     */
    formattedProfileTimestamp() {
      if (!this.node || !this.node.profile_timestamp) return '';

      // Check if timestamp might be in seconds (Unix epoch)
      let timestampValue = this.node.profile_timestamp;

      // If timestamp is a number and appears to be in seconds (before year 2100)
      if (typeof timestampValue === 'number' && timestampValue < 4102444800) {
        // Convert seconds to milliseconds
        timestampValue = timestampValue * 1000;
      }

      // Convert timestamp to Date object
      const timestamp = new Date(timestampValue);

      // Format the date in local time
      return timestamp.toLocaleString();
    },

    /**
     * Get filtered node properties excluding primary properties
     * that are already shown separately
     */
    filteredNodeProperties() {
      if (!this.node) return {};

      const result = {};
      // Add additional properties to exclude from the "Other Properties" section
      const excludedKeys = [
        'type', 'app_name', 'name', 'address', 'components', 
        'typeCounts', 'componentCounts', 'profile_timestamp'
      ];

      Object.entries(this.node).forEach(([key, value]) => {
        if (!excludedKeys.includes(key)) {
          result[key] = value;
        }
      });

      return result;
    },

    /**
     * Get outgoing (TO) relationships for the current node
     */
    outgoingRelationships() {
      return processNodeRelationships(this.node, this.graphData, 'outgoing');
    },

    /**
     * Get incoming (FROM) relationships for the current node
     */
    incomingRelationships() {
      return processNodeRelationships(this.node, this.graphData, 'incoming');
    },

    /**
     * Get outgoing relationships grouped by type
     */
    groupedOutgoingRelationships() {
      return groupRelationshipsByType(this.outgoingRelationships);
    },

    /**
     * Get incoming relationships grouped by type
     */
    groupedIncomingRelationships() {
      return groupRelationshipsByType(this.incomingRelationships);
    },


    /**
     * Check if there are any relationships
     */
    hasAnyRelationships() {
      return this.outgoingRelationships.length > 0 || this.incomingRelationships.length > 0;
    }
  },

  watch: {
    // When the node changes, set the active tabs based on available connections
    node() {
      this.setInitialActiveTabs();
    }
  },

  mounted() {
    // Set the initial active tabs based on available connections
    this.setInitialActiveTabs();
  },

  methods: {
    /**
     * Get color for node type badge
     */
    getNodeTypeColor,

    /**
     * Generate tooltip text for a node relationship
     * @param {Object} rel The relationship object
     * @returns {string} Tooltip text with complete node information
     */
    getNodeTooltip(rel) {
      // Get the node from the graph data
      const node = this.graphData.vertices[rel.nodeId];

      if (!node) return rel.nodeName;

      let tooltip = `${node.type}: ${rel.nodeName}`;

      // Add address information if it exists (this is the main purpose of the tooltip)
      if (node.address) {
        tooltip += `\nAddress: ${node.address}`;
      }

      if (node.protocol_multiplexor) {
        tooltip += `\nMux: ${node.protocol_multiplexor}`;
      }

      // Add app name if it exists
      if (node.app_name && node.app_name !== rel.nodeName) {
        tooltip += `\nApp: ${node.app_name}`;
      }

      // Add any additional key information
      if (node.provider) {
        tooltip += `\nProvider: ${node.provider}`;
      }

      return tooltip;
    },

    /**
     * Set the initial active tabs based on available connections
     */
    setInitialActiveTabs() {
      // Set connections tab
      if (this.outgoingRelationships.length === 0 && this.incomingRelationships.length > 0) {
        this.activeConnsTab = 'from';
      } else {
        this.activeConnsTab = 'to';
      }
    },

    /**
     * Format connection details in a consistent format: "address (protocol_multiplexor)"
     * @param {Object} rel The relationship object
     * @returns {string} Formatted connection details
     */
    formatConnectionDetails(rel) {
      // Get the node from the graph data
      const node = this.graphData.vertices[rel.nodeId];
      if (!node) return "";

      const address = node.address || node.name || node.app_name || "Unknown";
      const protocolMultiplexor = node.protocol_multiplexor || "Unknown";

      return `${address} (${protocolMultiplexor})`;
    },

    /**
     * Select a node in the main graph
     * @param {Object} rel The relationship object or component containing node information
     * @param {boolean} isShiftKey Whether the shift key was pressed during click
     */
    selectNodeInGraph(rel, isShiftKey = false) {
      // Check if this is a component (has originalData)
      if (rel.originalData) {
        console.log("NodeDetails: Selecting component with shift key:", isShiftKey);
        // For components, use the originalData
        this.$emit('select-node', rel.originalData, isShiftKey);
        return;
      }

      // For relationships, get the node data directly using the nodeId
      const nodeData = this.graphData.vertices[rel.nodeId];

      if (nodeData) {
        console.log("NodeDetails: Selecting node with shift key:", isShiftKey);
        // Emit an event to notify the parent components to select this node
        // Pass the shift key state to support multi-selection
        this.$emit('select-node', nodeData, isShiftKey);
      } else {
        console.warn(`Node with ID ${rel.nodeId} not found in current graph data (may be filtered out)`);
      }
    },

    /**
     * Close the details panel
     */
    closeDetails() {
      this.$emit('close');
    },

    /**
     * Generate a comprehensive tooltip for a component
     * @param {Object} component The component object
     * @returns {string} Tooltip text with complete component information
     */
    getComponentTooltip(component) {
      if (!component) return '';

      let tooltip = `${component.nodeType}: ${component.name || 'Unnamed'}`;

      if (component.address) {
        tooltip += `\nAddress: ${component.address}`;
      }

      if (component.protocol_multiplexor) {
        tooltip += `\nMux: ${component.protocol_multiplexor}`;
      }

      if (component.app_name && component.app_name !== component.name) {
        tooltip += `\nApp: ${component.app_name}`;
      }

      if (component.provider) {
        tooltip += `\nProvider: ${component.provider}`;
      }

      if (component.public_ip !== undefined) {
        tooltip += `\nIP: ${component.public_ip ? 'Public' : 'Private'}`;
      }

      return tooltip;
    },

    /**
     * Format component details for display in the list
     * @param {Object} component The component object
     * @returns {string} Formatted component details
     */
    formatComponentDetails(component) {
      if (!component) return '';

      // Determine the primary display value (either address or name)
      let primaryText = component.address || component.name || component.app_name || 'Unknown';

      // Add protocol multiplexor if available
      if (component.protocol_multiplexor) {
        primaryText += ` (${component.protocol_multiplexor})`;
      }

      return primaryText;
    },

    /**
     * Find edge between two nodes
     * @param {Object|string} sourceNode Source node or node ID
     * @param {Object|string} targetNode Target node or node ID
     * @returns {Object|null} The edge object or null if not found
     */
    findEdge(sourceNode, targetNode) {
      if (!this.graphData || !this.graphData.edges) return null;

      const sourceId = typeof sourceNode === 'string' ? sourceNode : 
                      (sourceNode.id || findNodeIdByProperties(sourceNode, this.graphData));

      const targetId = typeof targetNode === 'string' ? targetNode : 
                      (targetNode.id || findNodeIdByProperties(targetNode, this.graphData));

      if (!sourceId || !targetId) return null;

      return this.graphData.edges.find(edge => 
        edge.start_node === sourceId && edge.end_node === targetId
      );
    }
  }
};
</script>

<style scoped>
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

.connections-container {
  margin-bottom: 16px;
  background-color: #f9f9f9;
  border-radius: 6px;
  padding: 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.connections-header {
  padding: 8px 12px;
  background-color: #e0e0e0;
  margin: -10px -10px 10px -10px;
  border-radius: 6px 6px 0 0;
  border-bottom: 1px solid #d0d0d0;
  font-weight: normal;
  position: relative;
}

.connections-header::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: #4CAF50;
  border-radius: 6px 0 0 0;
}

.profile-timestamp-header {
  background-color: #FFE0D0;
  border-radius: 6px 6px 6px 6px;
  margin-left: 0px;
  margin-right: 0px;
}

.profile-timestamp-header::before {
  background-color: #FF6A33;
  border-radius: 6px 0 0 6px;
}

.connections-header h5 {
  margin: 0;
  font-size: 15px;
  color: #333;
  font-weight: 600;
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

.node-details h3 {
  margin-top: 0;
  padding-right: 25px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
  text-align: left;
  display: flex;
  align-items: center;
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


.node-main-properties {
  margin-bottom: 15px;
  background-color: #f5f7fa;
  padding: 15px;
  border-radius: 5px;
  border-left: 4px solid #4A98E3;
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
  padding: 5px 8px;
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

/* Tab styles */
.relationship-tabs {
  display: flex;
  border-bottom: 1px solid #eee;
  margin-bottom: 15px;
  margin-top: 5px;
}

.properties-header::before {
  background-color: #673AB7; /* Purple for properties */
}

.properties-header {
  background-color: #ede7f6; /* Light purple background */
}

.properties-container {
  overflow: hidden;
}


.tab-button {
  padding: 8px 16px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-weight: bold;
  color: #666;
  transition: all 0.2s ease;
}

.tab-button:hover {
  color: #4A98E3;
}

.tab-button.active {
  color: #4A98E3;
  border-bottom-color: #4A98E3;
}

.tab-content {
  padding-top: 3px;
}

.no-connections {
  color: #999;
  font-style: italic;
  padding: 10px 0;
}

.relationships-container {
  margin-top: 10px;
}

.relationship-group {
  margin-bottom: 8px;
  padding: 6px 8px;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.relationship-group h5 {
  margin-top: 0;
  margin-bottom: 6px;
  font-size: 14px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 3px;
}

.relationship-list {
  list-style-type: none;
  padding-left: 4px;
  margin: 0;
}

.relationship-item {
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  font-size: 13px;
  cursor: pointer;
  padding: 3px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.relationship-item:last-child {
  margin-bottom: 0;
}

.relationship-item:hover {
  background-color: #eef5fd;
}

.component-item {
  cursor: default;
}

.component-item:hover {
  background-color: #f5f5f5;
}

.component-item .connection-details {
  cursor: default;
}

.component-item .connection-details:hover {
  text-decoration: none;
  color: #555;
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

.node-link {
  color: #2c3e50;
  text-decoration: none;
  border-bottom: 1px dotted #ccc;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.connection-details {
  flex: 1;
  color: #555;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.connection-details:hover {
  text-decoration: underline;
  color: #4A98E3;
}
</style>
