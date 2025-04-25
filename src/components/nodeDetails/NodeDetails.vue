// src/components/nodeDetails/NodeDetails.vue
<template>
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

    <!-- Node Outgoing Relationships Section -->
    <div class="detail-section" v-if="relationships.length > 0">
      <h4>Outgoing Connections</h4>
      <div class="relationships-container">
        <div v-for="(group, index) in groupedRelationships" :key="index" class="relationship-group">
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
</template>

<script>
import { getNodeTypeColor } from '@/utils/nodeUtils';
import { processNodeRelationships } from '@/utils/relationshipUtils';

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
     * Get all relationships for the current node
     */
    relationships() {
      return processNodeRelationships(this.node, this.graphData);
    },

    /**
     * Get outgoing relationships grouped by type
     */
    groupedRelationships() {
      if (!this.relationships.length) return [];

      // Create an object to hold the grouped relationships
      const groupedByType = {};

      this.relationships.forEach(rel => {
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

  methods: {
    /**
     * Get color for node type badge
     */
    getNodeTypeColor,

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