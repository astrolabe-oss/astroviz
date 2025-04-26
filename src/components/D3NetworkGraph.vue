<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

// src/components/D3NetworkGraph.vue
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
        @reset-positions="onResetPositions"
    />

    <GraphVisualization
        ref="visualization"
        :graphData="graphData"
        :viewMode="viewMode"
        :nodeColors="nodeColors"
        :highlighted-node-ids="highlightedNodeIds"
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
import { findNodeIdByProperties } from '@/utils/nodeUtils';

export default {
  name: 'D3NetworkGraph',

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
    // Current view mode: 'detailed' or 'application'
    viewMode: {
      type: String,
      required: true,
      default: 'detailed'
    },
    // Set of node IDs that should be highlighted
    highlightedNodeIds: {
      type: Set,
      default: () => new Set()
    }
  },

  data() {
    return {
      nodeColors: {
        'Application': '#F9696E', // Red like in the image
        'Deployment': '#F2A3B3', // Pink like in the image
        'Compute': '#5DCAD1', // Light blue like in the image
        'Resource': '#74B56D', // Green like in the image
        'TrafficController': '#4A98E3', // Blue like in the image
        'Public IP': '#E0E0E0', // Keep Public IP in legend but not as a node type
        'Unknown': '#F9C96E', // Orange for unknown nodes
      },

      isRendering: false,
      nodeCount: 0,
      edgeCount: 0,
      showStats: false,
      currentZoomLevel: 1
    };
  },

  methods: {
    /**
     * Handle node click event from the visualization
     * @param {Object} node The clicked node data
     */
    onNodeClick(node) {
      this.$emit('node-clicked', node);
    },

    /**
     * Select a node in the visualization by ID
     * @param {string} nodeId The ID of the node to select
     */
    selectNodeById(nodeId) {
      if (this.$refs.visualization) {
        this.$refs.visualization.selectAndHighlightNode(nodeId);
      }
    },

    /**
     * Select a node in the visualization by properties
     * @param {Object} nodeData The node data to find and select
     */
    selectNodeByProperties(nodeData) {
      // Find the node ID from the properties
      const nodeId = findNodeIdByProperties(nodeData, this.graphData);

      if (nodeId) {
        this.selectNodeById(nodeId);
      } else {
        console.warn('D3NetworkGraph: Node not found with properties', nodeData);
      }
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
     * Handle reset positions button click
     */
    onResetPositions() {
      if (this.$refs.visualization) {
        this.$refs.visualization.resetNodePositions();
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