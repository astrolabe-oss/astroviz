// src/components/graph/GraphLegend.vue
<template>
  <div class="legend">
    <div v-for="(color, type) in nodeColors" :key="type" class="legend-item">
      <div class="legend-icon" v-html="getLegendIcon(type)"></div>
      <div class="legend-label">{{ type }}</div>
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

  methods: {
    /**
     * Get a small version of the icon for the legend
     * @param {string} type The node type
     * @returns {string} SVG HTML string
     */
    getLegendIcon(type) {
      // Get the icon SVG from networkIcons
      const iconSvg = networkIcons[type] || networkIcons.default;

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