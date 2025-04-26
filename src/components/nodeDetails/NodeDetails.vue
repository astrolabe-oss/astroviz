<template>
<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->


  <div v-if="node" class="node-details">
    <h3>Node: <span class="node-type-header-badge" :style="{ backgroundColor: getNodeTypeColor(node.type) }">{{ node.type }}</span></h3>
    <button class="close-button" @click="closeDetails">×</button>

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

    <!-- Node Other Properties Section -->
    <div class="detail-section">
      <h4>Other Properties</h4>
      <div class="node-properties">
        <div v-for="(value, key) in filteredNodeProperties" :key="key" class="property">
          <strong>{{ key }}:</strong> {{ value }}
        </div>
      </div>
    </div>

    <!-- Node Relationships Section with Tabs -->
    <div class="detail-section" v-if="outgoingRelationships.length > 0 || incomingRelationships.length > 0">
      <div class="relationship-tabs">
        <button
            :class="['tab-button', { active: activeTab === 'to' }]"
            @click="activeTab = 'to'"
        >
          TO ({{ outgoingRelationships.length }})
        </button>
        <button
            :class="['tab-button', { active: activeTab === 'from' }]"
            @click="activeTab = 'from'"
        >
          FROM ({{ incomingRelationships.length }})
        </button>
      </div>

      <!-- TO Connections Tab -->
      <div v-if="activeTab === 'to'" class="tab-content">
        <div v-if="outgoingRelationships.length === 0" class="no-connections">
          No outgoing connections
        </div>
        <div v-else class="relationships-container">
          <div v-for="(group, index) in groupedOutgoingRelationships" :key="`out-${index}`" class="relationship-group">
            <h5>{{ group.type }}</h5>
            <ul class="relationship-list">
              <li
                  v-for="(rel, relIndex) in group.relationships"
                  :key="`out-${relIndex}`"
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
      <div v-if="activeTab === 'from'" class="tab-content">
        <div v-if="incomingRelationships.length === 0" class="no-connections">
          No incoming connections
        </div>
        <div v-else class="relationships-container">
          <div v-for="(group, index) in groupedIncomingRelationships" :key="`in-${index}`" class="relationship-group">
            <h5>{{ group.type }}</h5>
            <ul class="relationship-list">
              <li
                  v-for="(rel, relIndex) in group.relationships"
                  :key="`in-${relIndex}`"
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
</template>

<script>
import { getNodeTypeColor } from '@/utils/nodeUtils';
import { processNodeRelationships, groupRelationshipsByType } from '@/utils/relationshipUtils';

export default {
  name: 'NodeDetails',

  props: {
    node: {
      type: Object,
      default: null
    },
    graphData: {
      type: Object,
      required: true
    }
  },

  data() {
    return {
      activeTab: 'to'  // Default to TO tab
    };
  },

  computed: {
    /**
     * Get filtered node properties excluding primary properties
     * that are already shown separately
     */
    filteredNodeProperties() {
      if (!this.node) return {};

      const result = {};
      const excludedKeys = ['type', 'app_name', 'name', 'address'];

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
    }
  },

  watch: {
    // When the node changes, set the active tab based on available connections
    node() {
      this.setInitialActiveTab();
    }
  },

  mounted() {
    // Set the initial active tab based on available connections
    this.setInitialActiveTab();
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
     * Set the initial active tab based on available connections
     */
    setInitialActiveTab() {
      // If there are no outgoing connections but there are incoming connections,
      // set the active tab to 'from'
      if (this.outgoingRelationships.length === 0 && this.incomingRelationships.length > 0) {
        this.activeTab = 'from';
      } else {
        // Otherwise, default to 'to' tab
        this.activeTab = 'to';
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

      const address = node.address || "Unknown";
      const protocolMultiplexor = node.protocol_multiplexor || "Unknown";

      return `${address} (${protocolMultiplexor})`;
    },

    /**
     * Select a node in the main graph
     * @param {Object} rel The relationship object containing nodeId and node type information
     * @param {boolean} isShiftKey Whether the shift key was pressed during click
     */
    selectNodeInGraph(rel, isShiftKey = false) {
      // Get the node data directly using the nodeId from the relationship
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

/* Tab styles */
.relationship-tabs {
  display: flex;
  border-bottom: 1px solid #eee;
  margin-bottom: 15px;
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
  padding-top: 5px;
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

.relationship-item {
  margin-bottom: 7px;
  display: flex;
  align-items: center;
  font-size: 13px;
  cursor: pointer;
  padding: 3px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.relationship-item:hover {
  background-color: #eef5fd;
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