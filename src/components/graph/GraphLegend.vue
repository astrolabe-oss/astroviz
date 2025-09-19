<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

// src/components/graph/GraphLegend.vue
<template>
  <div class="legend">
    <!-- Node Types Section -->
    <div class="legend-section">
      <div class="legend-heading">Nerd Types</div>
      <div v-for="type in nodeTypes" :key="type" class="legend-item">
        <div class="legend-icon" v-html="getLegendIcon(type)"></div>
        <div class="legend-label">{{ getDisplayName(type) }}</div>
      </div>
    </div>

    <!-- Annotations Section -->
    <div class="legend-section">
      <div class="legend-heading">Annotations</div>
      <div v-for="type in annotationTypes" :key="type" class="legend-item">
        <div class="legend-icon" v-html="getLegendIcon(type)"></div>
        <div class="legend-label">{{ getAnnotationDisplayName(type) }}</div>
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
      return Object.keys(this.nodeColors).filter(type =>
        type !== 'Application'
      );
    },

    /**
     * Returns only annotation icons (currently just 'Public IP', 'Virtual Application', 'Private Network', and 'Internet Boundary')
     * @returns {Array} Array of annotation type names
     */
    annotationTypes() {
      return ['Internet\nBoundary', 'Private\nNetwork', 'Cluster', 'Application'];
    }
  },

  methods: {
    /**
     * Get display name for node types
     * @param {string} type The technical node type
     * @returns {string} Display name for the legend
     */
    getDisplayName(type) {
      const displayNames = {
        'Deployment': 'Pointy Haired Boss',
        'Compute': 'IC',
        'Resource': 'Contractor',
        'TrafficController': 'Basically A Big Wig',
        'Unknown': 'Too Cool for School'
      };
      return displayNames[type] || type;
    },

    /**
     * Get display name for annotation types
     * @param {string} type The technical annotation type
     * @returns {string} Display name for the legend
     */
    getAnnotationDisplayName(type) {
      const displayNames = {
        'Application': 'Company',
        'Cluster': 'Mid Life Crisis Type',
        'Private\nNetwork': 'Industry',
        'Internet\nBoundary': 'Delusion Type'
      };
      return displayNames[type] || type;
    },

    /**
     * Get a small version of the icon for the legend
     * @param {string} type The node type
     * @returns {string} SVG HTML string
     */
    getLegendIcon(type) {
      if (type === 'Private\nNetwork') {
        // Create a special dashed circle for the private network matching graph styling
        const fillColor = '#f0f0f0'; // Match the actual graph fill
        const strokeColor = '#888'; // Match the actual graph stroke
        const size = 10;

        return `<svg style="width: 24px; height: 24px;" viewBox="0 0 24 24">
                  <g transform="translate(12, 12)">
                    <circle cx="0" cy="0" r="${size}" fill="${fillColor}" fill-opacity="0.6" stroke="${strokeColor}" stroke-width="2" stroke-dasharray="5,5" />
                  </g>
                </svg>`;
      }

      if (type === 'Internet\nBoundary') {
        // Create a special dashed circle for the Internet Boundary with blue color and long-short dashes
        const color = '#4A98E3'; // Blue color
        const size = 12; // Slightly larger than Private Network

        return `<svg style="width: 24px; height: 24px;" viewBox="0 0 24 24">
                  <g transform="translate(12, 12)">
                    <circle cx="0" cy="0" r="${size}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="6,2,1,2" />
                  </g>
                </svg>`;
      }

      if (type === 'Application') {
        // Create a dashed circle for application groups matching the graph styling
        const fillColor = '#FFE6CC'; // Orange background
        const strokeColor = '#FF9933'; // Orange border
        const size = 10;

        return `<svg style="width: 24px; height: 24px;" viewBox="0 0 24 24">
                  <g transform="translate(12, 12)">
                    <circle cx="0" cy="0" r="${size}" 
                          fill="${fillColor}" fill-opacity="0.6" 
                          stroke="${strokeColor}" stroke-width="2" stroke-dasharray="3,3" />
                  </g>
                </svg>`;
      }

      if (type === 'Cluster') {
        // Create a dashed circle for cluster groups matching the graph styling
        const fillColor = '#E8F4FD'; // Light blue background
        const strokeColor = '#5B8FF9'; // Blue border
        const size = 10;

        return `<svg style="width: 24px; height: 24px;" viewBox="0 0 24 24">
                  <g transform="translate(12, 12)">
                    <circle cx="0" cy="0" r="${size}" 
                          fill="${fillColor}" fill-opacity="0.6" 
                          stroke="${strokeColor}" stroke-width="2" stroke-dasharray="8,4" />
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
  bottom: 20px;
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
  white-space: pre-line; /* Support line breaks in labels */
}
</style>
