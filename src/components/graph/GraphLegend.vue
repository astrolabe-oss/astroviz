<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

// src/components/graph/GraphLegend.vue
<template>
  <div class="legend">
    <!-- Node Types Section -->
    <div class="legend-section">
      <div class="legend-heading">Node Types</div>
      <div v-for="type in nodeTypes" :key="type" class="legend-item">
        <div class="legend-icon" v-html="getLegendIcon(type)"></div>
        <div class="legend-label">{{ type }}</div>
      </div>
    </div>
    
    <!-- Annotations Section -->
    <div class="legend-section">
      <div class="legend-heading">Annotations</div>
      <div v-for="type in annotationTypes" :key="type" class="legend-item">
        <div class="legend-icon" v-html="getLegendIcon(type)"></div>
        <div class="legend-label">{{ type }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import networkIcons from '../networkIcons';

export default {
  name: 'GraphLegend',

  props: {
    nodeColors: {
      type: Object,
      required: true
    }
  },
  
  computed: {
    /**
     * Returns only node type icons (excluding 'Public IP')
     * @returns {Array} Array of node type names
     */
    nodeTypes() {
      return Object.keys(this.nodeColors).filter(type => type !== 'Public IP');
    },
    
    /**
     * Returns only annotation icons (currently just 'Public IP' and 'Virtual Application')
     * @returns {Array} Array of annotation type names
     */
    annotationTypes() {
      return ['Public IP', 'Virtual'];
    }
  },

  methods: {
    /**
     * Get a small version of the icon for the legend
     * @param {string} type The node type
     * @returns {string} SVG HTML string
     */
    getLegendIcon(type) {
      if (type === 'Virtual') {
        // For Virtual Nodes, use the Application icon with dashed circle and transparency
        const appColor = this.nodeColors['Application'];

        // Calculate the circle radius - should be 1.3x the icon size/2
        const iconSize = 12;

        return `<svg style="width: 24px; height: 24px;" viewBox="0 0 24 24">
                  <g transform="translate(12, 12)">
                    <circle cx="0" cy="0" r="${iconSize}" fill="none" stroke="${appColor}" stroke-dasharray="3,3" />
                    <g transform="translate(-${iconSize * .75}, -${iconSize * .75}) scale(${18 / 24})" style="color: ${appColor}; opacity: 0.5;">
                      ${networkIcons['Application']}
                    </g>
                  </g>
                </svg>`;
      }
      
      // Special case for 'Public IP' which should use the PublicIP icon
      const iconKey = type === 'Public IP' ? 'PublicIP' : type;
      
      // Get the icon SVG from networkIcons
      const iconSvg = networkIcons[iconKey] || networkIcons.default;

      // Return the SVG with styling specific to the legend
      return iconSvg.replace('<svg', `<svg style="width: 20px; height: 20px; color: ${this.nodeColors[type]}"`);
    }
  }
};
</script>

<style scoped>
.legend {
  position: absolute;
  bottom: 40px;
  left: 10px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 10px;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.legend-section {
  margin-bottom: 12px;
}

.legend-section:last-child {
  margin-bottom: 0;
}

.legend-heading {
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 8px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 4px;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.legend-icon {
  width: 24px;
  height: 24px;
  margin-right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.legend-label {
  font-size: 12px;
}
</style>