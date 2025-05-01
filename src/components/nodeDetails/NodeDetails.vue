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

    <!-- Components Section for Application view -->
    <div class="detail-section" v-if="viewMode === 'application' && nodeComponents.length > 0">
      <div class="connections-container components-container">
        <div class="connections-header components-header">
          <h5>Components</h5>
        </div>
        
        <div class="tab-content">
          <div v-if="nodeComponents.length === 0" class="no-connections">
            No components
          </div>
          <div v-else>
            <div v-for="(group, index) in groupedNodeComponents" :key="`component-group-${index}`" class="relationship-group">
              <h5>{{ group.type }} ({{ group.components.length }})</h5>
              <ul class="relationship-list">
                <li
                  v-for="(component, compIndex) in group.components"
                  :key="`component-${index}-${compIndex}`"
                  class="relationship-item component-item"
                  :title="getComponentTooltip(component)"
                >
                  <span class="node-type-badge" :style="{ backgroundColor: getNodeTypeColor(component.nodeType) }">
                    {{ component.nodeType }}
                  </span>
                  <span class="connection-details">
                    {{ formatComponentDetails(component) }}
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
          <h5>Other Properties</h5>
        </div>
        
        <div class="node-properties">
          <div v-for="(value, key) in filteredNodeProperties" :key="key" class="property">
            <strong>{{ key }}:</strong> {{ value }}
          </div>
        </div>
      </div>
    </div>

    <!-- Node Relationships Section -->
    <div class="detail-section" v-if="hasAnyRelationships">
      <!-- Real Connections Container -->
      <div class="connections-container">
        <div class="connections-header">
          <h5>Real Connections</h5>
        </div>
    
        <!-- Real Connections Tabs -->
        <div class="relationship-tabs">
          <button
              :class="['tab-button', { active: realActiveTab === 'to' }]"
              @click="realActiveTab = 'to'"
          >
            TO ({{ realOutgoingRelationships.length }})
          </button>
          <button
              :class="['tab-button', { active: realActiveTab === 'from' }]"
              @click="realActiveTab = 'from'"
          >
            FROM ({{ realIncomingRelationships.length }})
          </button>
        </div>
    
        <!-- Real TO Connections Tab -->
        <div v-if="realActiveTab === 'to'" class="tab-content">
          <div v-if="realOutgoingRelationships.length === 0" class="no-connections">
            No real outgoing connections
          </div>
          <div v-else>
            <div v-for="(group, index) in groupedRealOutgoingRelationships" :key="`real-out-${index}`" class="relationship-group">
              <h5>{{ group.type }}</h5>
              <ul class="relationship-list">
                <li
                    v-for="(rel, relIndex) in group.relationships"
                    :key="`real-out-${relIndex}`"
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
        
        <!-- Real FROM Connections Tab -->
        <div v-if="realActiveTab === 'from'" class="tab-content">
          <div v-if="realIncomingRelationships.length === 0" class="no-connections">
            No real incoming connections
          </div>
          <div v-else>
            <div v-for="(group, index) in groupedRealIncomingRelationships" :key="`real-in-${index}`" class="relationship-group">
              <h5>{{ group.type }}</h5>
              <ul class="relationship-list">
                <li
                    v-for="(rel, relIndex) in group.relationships"
                    :key="`real-in-${relIndex}`"
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
      
      <!-- Virtual Connections Container (Application View Only) -->
      <div v-if="viewMode === 'application' && hasVirtualRelationships" class="connections-container virtual-connections-container">
        <div class="connections-header virtual-header">
          <h5>Virtual Connections (Aggregated)</h5>
        </div>
        
        <!-- Virtual Connections Tabs -->
        <div class="relationship-tabs">
          <button
              :class="['tab-button', { active: virtualActiveTab === 'to' }]"
              @click="virtualActiveTab = 'to'"
          >
            TO ({{ virtualOutgoingRelationships.length }})
          </button>
          <button
              :class="['tab-button', { active: virtualActiveTab === 'from' }]"
              @click="virtualActiveTab = 'from'"
          >
            FROM ({{ virtualIncomingRelationships.length }})
          </button>
        </div>
    
        <!-- Virtual TO Connections Tab -->
        <div v-if="virtualActiveTab === 'to'" class="tab-content">
          <div v-if="virtualOutgoingRelationships.length === 0" class="no-connections">
            No virtual outgoing connections
          </div>
          <div v-else>
            <div v-for="(group, index) in groupedVirtualOutgoingRelationships" :key="`virtual-out-${index}`" class="relationship-group">
              <h5>{{ group.type }}</h5>
              <ul class="relationship-list">
                <li
                    v-for="(rel, relIndex) in group.relationships"
                    :key="`virtual-out-${relIndex}`"
                    class="relationship-item"
                    @click="(event) => selectNodeInGraph(rel, event.shiftKey)"
                >
                  <span class="node-type-badge virtual-badge" :style="{ backgroundColor: getNodeTypeColor(rel.nodeType) }">
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
        
        <!-- Virtual FROM Connections Tab -->
        <div v-if="virtualActiveTab === 'from'" class="tab-content">
          <div v-if="virtualIncomingRelationships.length === 0" class="no-connections">
            No virtual incoming connections
          </div>
          <div v-else>
            <div v-for="(group, index) in groupedVirtualIncomingRelationships" :key="`virtual-in-${index}`" class="relationship-group">
              <h5>{{ group.type }}</h5>
              <ul class="relationship-list">
                <li
                    v-for="(rel, relIndex) in group.relationships"
                    :key="`virtual-in-${relIndex}`"
                    class="relationship-item"
                    @click="(event) => selectNodeInGraph(rel, event.shiftKey)"
                >
                  <span class="node-type-badge virtual-badge" :style="{ backgroundColor: getNodeTypeColor(rel.nodeType) }">
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
    },
    viewMode: {
      type: String,
      default: 'detailed'
    }
  },

  data() {
    return {
      realActiveTab: 'to',   // Default to TO tab for real connections
      virtualActiveTab: 'to'  // Default to TO tab for virtual connections
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
      // Add additional properties to exclude from the "Other Properties" section
      const excludedKeys = [
        'type', 'app_name', 'name', 'address', 'components', 
        'typeCounts', 'componentCounts'
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
     * Get components for the current node in application view
     * Components are extracted from the node's components property if it exists
     * and grouped by component type
     */
    nodeComponents() {
      if (!this.node || !this.node.components || this.viewMode !== 'application') {
        return [];
      }
      
      // Convert and process components data
      const components = this.node.components.map(component => {
        return {
          nodeType: component.type || 'Component',
          name: component.name || '',
          address: component.address || '',
          app_name: component.app_name || '',
          provider: component.provider || '',
          protocol_multiplexor: component.protocol_multiplexor || '',
          public_ip: component.public_ip,
          // Include the original component data for selection
          originalData: component
        };
      });
      
      return components;
    },
    
    /**
     * Group node components by their type
     */
    groupedNodeComponents() {
      if (!this.nodeComponents.length) {
        return [];
      }
      
      // Group components by their nodeType
      const groupedByType = {};
      this.nodeComponents.forEach(component => {
        const type = component.nodeType;
        if (!groupedByType[type]) {
          groupedByType[type] = [];
        }
        groupedByType[type].push(component);
      });
      
      // Convert to array format for easier rendering
      return Object.entries(groupedByType).map(([type, components]) => {
        return {
          type,
          components
        };
      });
    },
    
    /**
     * Get real outgoing relationships (non-virtual connections)
     */
    realOutgoingRelationships() {
      if (this.viewMode !== 'application') {
        return this.outgoingRelationships;
      }
      return this.outgoingRelationships.filter(rel => {
        const edge = this.findEdge(this.node, rel.nodeId);
        return !edge || !edge.connectedComponents;
      });
    },
    
    /**
     * Get virtual outgoing relationships (virtual connections)
     */
    virtualOutgoingRelationships() {
      if (this.viewMode !== 'application') {
        return [];
      }
      return this.outgoingRelationships.filter(rel => {
        const edge = this.findEdge(this.node, rel.nodeId);
        return edge && edge.connectedComponents;
      });
    },
    
    /**
     * Get real incoming relationships (non-virtual connections)
     */
    realIncomingRelationships() {
      if (this.viewMode !== 'application') {
        return this.incomingRelationships;
      }
      return this.incomingRelationships.filter(rel => {
        const edge = this.findEdge(rel.nodeId, this.node);
        return !edge || !edge.connectedComponents;
      });
    },
    
    /**
     * Get virtual incoming relationships (virtual connections)
     */
    virtualIncomingRelationships() {
      if (this.viewMode !== 'application') {
        return [];
      }
      return this.incomingRelationships.filter(rel => {
        const edge = this.findEdge(rel.nodeId, this.node);
        return edge && edge.connectedComponents;
      });
    },
    
    /**
     * Get real outgoing relationships grouped by type
     */
    groupedRealOutgoingRelationships() {
      return groupRelationshipsByType(this.realOutgoingRelationships);
    },
    
    /**
     * Get virtual outgoing relationships grouped by type
     */
    groupedVirtualOutgoingRelationships() {
      return groupRelationshipsByType(this.virtualOutgoingRelationships);
    },
    
    /**
     * Get real incoming relationships grouped by type
     */
    groupedRealIncomingRelationships() {
      return groupRelationshipsByType(this.realIncomingRelationships);
    },
    
    /**
     * Get virtual incoming relationships grouped by type
     */
    groupedVirtualIncomingRelationships() {
      return groupRelationshipsByType(this.virtualIncomingRelationships);
    },
    
    /**
     * Check if there are any relationships (real or virtual)
     */
    hasAnyRelationships() {
      return this.realOutgoingRelationships.length > 0 || 
             this.realIncomingRelationships.length > 0 ||
             (this.viewMode === 'application' && this.hasVirtualRelationships);
    },
    
    /**
     * Check if there are any virtual relationships
     */
    hasVirtualRelationships() {
      return this.virtualOutgoingRelationships.length > 0 || 
             this.virtualIncomingRelationships.length > 0;
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
      // Set real connections tab
      if (this.realOutgoingRelationships.length === 0 && this.realIncomingRelationships.length > 0) {
        this.realActiveTab = 'from';
      } else {
        this.realActiveTab = 'to';
      }
      
      // Set virtual connections tab
      if (this.virtualOutgoingRelationships.length === 0 && this.virtualIncomingRelationships.length > 0) {
        this.virtualActiveTab = 'from';
      } else {
        this.virtualActiveTab = 'to';
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
  overflow: hidden; /* Ensure the header doesn't break the container's rounded corners */
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

.connections-header h5 {
  margin: 0;
  font-size: 15px;
  color: #333;
  font-weight: 600;
}

.virtual-connections-container {
  margin-top: 20px;
  border-top: 2px dashed #ddd;
  padding-top: 20px;
}

.virtual-header::before {
  background-color: #2196F3;
}

.virtual-header {
  background-color: #e3f2fd;
}

.virtual-badge::after {
  content: '↝';
  font-size: 12px;
  margin-left: 3px;
  opacity: 0.7;
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