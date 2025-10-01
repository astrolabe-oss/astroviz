<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

// src/components/NetworkGraph.vue
<template>
  <div class="network-graph">
    <RenderingStatus
        :isRendering="isRendering"
        :nodeCount="nodeCount"
        :edgeCount="edgeCount"
    />

    <GraphControls
        :currentZoomLevel="currentZoomLevel"
        @zoom-in="onZoomIn"
        @zoom-out="onZoomOut"
        @reset-view="onResetView"
    />

    <GraphVisualization
        ref="visualization"
        :graphData="graphData"
        :nodeColors="nodeColors"
        :filteredOutNodeIds="filteredOutNodeIds"
        @node-clicked="onNodeClick"
        @rendering-start="onRenderingStart"
        @rendering-complete="onRenderingComplete"
        @zoom-change="onZoomChange"
    />

    <GraphLegend :nodeColors="nodeColors" />

    <GraphStats
        :show="showStats"
        :nodeCount="nodeCount"
        :edgeCount="edgeCount"
    />
  </div>
</template>

<script>
import GraphVisualization from './graph/GraphVisualization.vue';
import GraphControls from './graph/GraphControls.vue';
import GraphLegend from './graph/GraphLegend.vue';
import GraphStats from './graph/GraphStats.vue';
import RenderingStatus from './graph/RenderingStatus.vue';

export default {
  name: 'NetworkGraph',

  components: {
    GraphVisualization,
    GraphControls,
    GraphLegend,
    GraphStats,
    RenderingStatus
  },

  props: {
    // Graph data from Neo4j
    graphData: {
      type: Object,
      required: true,
      default: () => ({ vertices: {}, edges: [] })
    },
    // Set of node IDs that should be dimmed (don't match filters)
    filteredOutNodeIds: {
      type: Set,
      default: () => new Set()
    }
  },

  data() {
    return {
      nodeColors: {
        'Application': '#F9696E', // Red
        'Deployment': '#F2A3B3', // Pink
        'Compute': '#5DCAD1', // Light
        'Resource': '#74B56D', // Green
        'TrafficController': '#4A98E3', // Blue
        'Unknown': '#F9C96E', // Orange
      },

      isRendering: false,
      nodeCount: 0,
      edgeCount: 0,
      showStats: true,
      currentZoomLevel: 1
    };
  },

  methods: {
    /**
     * Handle node click event from the visualization
     * @param {Object} node The clicked node data
     * @param {Object} event The DOM event object
     */
    onNodeClick(node, event) {
      // Pass node data and event to parent
      this.$emit('node-clicked', node, event);
    },


    /**
     * Handle rendering start event
     */
    onRenderingStart() {
      this.isRendering = true;
      this.showStats = false;
    },

    /**
     * Handle rendering complete event
     * @param {Object} stats Object with nodeCount and linkCount properties
     */
    onRenderingComplete(stats) {
      this.nodeCount = stats.nodeCount;
      this.edgeCount = stats.linkCount;
      this.isRendering = false;
      this.showStats = true;
    },

    /**
     * Handle zoom level change
     * @param {number} level The new zoom level
     */
    onZoomChange(level) {
      this.currentZoomLevel = level;
    },

    /**
     * Handle zoom in button click
     */
    onZoomIn() {
      if (this.$refs.visualization) {
        this.$refs.visualization.zoomIn();
      }
    },

    /**
     * Handle zoom out button click
     */
    onZoomOut() {
      if (this.$refs.visualization) {
        this.$refs.visualization.zoomOut();
      }
    },

    /**
     * Handle reset view button click
     */
    onResetView() {
      if (this.$refs.visualization) {
        this.$refs.visualization.resetView();
      }
    },

    /**
     * Select/highlight a node by its ID
     * @param {string} nodeId The ID of the node to select
     * @param {boolean} appendToSelection Whether to add to existing selection
     */
    selectNodeById(nodeId, appendToSelection = false) {
      if (this.$refs.visualization) {
        this.$refs.visualization.selectNodeById(nodeId, appendToSelection);
      }
    }
  }
};
</script>

<style scoped>
.network-graph {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
