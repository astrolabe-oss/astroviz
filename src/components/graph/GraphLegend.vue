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

    <!-- Connections Section -->
    <div class="legend-section">
      <div class="legend-heading">Connections</div>
      <div v-for="connectionType in connectionTypes" :key="connectionType" class="legend-item">
        <div class="legend-icon" v-html="getLegendIcon(connectionType)"></div>
        <div class="legend-label">{{ connectionType }}</div>
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
      return Object.keys(this.nodeColors).filter(type =>
        type !== 'Application'
      );
    },

    /**
     * Returns connection type icons for inbound and outbound edges
     * @returns {Array} Array of connection type names
     */
    connectionTypes() {
      return ['Outbound\nConnection', 'Inbound\nConnection', 'Trace Path'];
    },

    /**
     * Returns only annotation icons (currently just 'Public IP', 'Virtual Application', 'Private Network', and 'Internet Boundary')
     * @returns {Array} Array of annotation type names
     */
    annotationTypes() {
      return ['Public IP', 'Internet\nBoundary', 'Private\nNetwork', 'Cluster', 'Application'];
    }
  },

  methods: {
    /**
     * Get a small version of the icon for the legend
     * @param {string} type The node type
     * @returns {string} SVG HTML string
     */
    getLegendIcon(type) {
      if (type === 'Outbound\nConnection') {
        // Create a solid purple line with arrow for outbound connections
        const strokeColor = '#4444ff'; // Purple color matching highlighted edges
        
        return `<svg style="width: 24px; height: 24px;" viewBox="0 0 24 24">
                  <defs>
                    <marker id="legend-arrow-outbound" viewBox="0 0 10 10" refX="7" refY="5" 
                            markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="${strokeColor}" />
                    </marker>
                  </defs>
                  <line x1="2" y1="12" x2="22" y2="12" 
                        stroke="${strokeColor}" stroke-width="2" 
                        marker-end="url(#legend-arrow-outbound)" />
                </svg>`;
      }

      if (type === 'Inbound\nConnection') {
        // Create a dashed purple line with arrow for inbound connections (arrow pointing left)
        const strokeColor = '#4444ff'; // Purple color matching highlighted edges
        
        return `<svg style="width: 24px; height: 24px;" viewBox="0 0 24 24">
                  <defs>
                    <marker id="legend-arrow-inbound" viewBox="0 0 10 10" refX="2" refY="5" 
                            markerWidth="4" markerHeight="4" orient="auto">
                      <path d="M 10 0 L 0 5 L 10 10 z" fill="${strokeColor}" />
                    </marker>
                  </defs>
                  <line x1="1" y1="12" x2="22" y2="12"
                        stroke="${strokeColor}" stroke-width="2" 
                        stroke-dasharray="3,2"
                        marker-start="url(#legend-arrow-inbound)" />
                </svg>`;
      }


      if (type === 'Trace Path') {
        // Create a dashed purple line with arrow for inbound connections (arrow pointing left)
        const strokeColor = '#FFA500'; // Golden color matching trace "golden" path

        return `<svg style="width: 24px; height: 24px;" viewBox="0 0 24 24">
                  <line x1="0" y1="12" x2="22" y2="12"
                        stroke="${strokeColor}" stroke-width="3"/>
                </svg>`;
      }

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
