<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div id="graph-container" class="graph-widget"></div>
</template>

<script>
import { GraphRenderer } from './renderer/graphRenderer.js';
import { transformGraphDataForVisualization } from './graphTransformUtils.js';

export default {
  name: 'GraphVisualization',

  props: {
    graphData: {
      type: Object,
      required: true,
      default: () => ({ vertices: {}, edges: [] })
    },
    nodeColors: {
      type: Object,
      required: true
    },
    // Set of node IDs that should be dimmed (don't match filters)
    filteredOutNodeIds: {
      type: Set,
      default: () => new Set()
    }
  },

  data() {
    return {
      graph: null
    };
  },

  mounted() {
    console.log('GraphVisualization mounted, waiting for DOM...');
    this.$nextTick(() => {
      console.log('DOM ready, initializing Graph');
      this.initializeGraph();
    });
  },

  beforeDestroy() {
    if (this.graph) {
      console.log('Destroying D3 Graph instance');
      this.graph.destroy();
    }
  },

  watch: {
    graphData: {
      handler(newData) {
        console.log('GraphData changed, updating graph');
        this.updateGraph(newData);
      },
      deep: true
    },
    
    filteredOutNodeIds: {
      handler(newFilteredOut) {
        console.log('FilteredOutNodeIds changed, updating filter dimming');
        if (this.graph) {
          this.graph.setFilterDimming(newFilteredOut);
        }
      },
      immediate: true
    }
  },

  methods: {
    initializeGraph() {
      console.log('Initializing D3 Graph with container');

      const container = document.getElementById('graph-container');
      if (!container) {
        console.error('Container element #graph-container not found!');
        return;
      }

      // Get container dimensions
      const { width, height } = container.getBoundingClientRect();
      console.log('Container dimensions:', width, 'x', height);

      // Create Graph Renderer instance
      this.graph = new GraphRenderer(container, {
        width: width || window.innerWidth,
        height: height || window.innerHeight,
        onNodeClick: (node, event) => {
          // Emit node click event to parent
          this.$emit('node-clicked', node, event);
        },
        onZoomChange: (zoomLevel) => {
          // Emit zoom change event to parent
          this.$emit('zoom-change', zoomLevel);
        }
      });

      console.log('Graph Renderer initialized successfully');

      // Load real data if available
      if (this.graphData && this.graphData.vertices && Object.keys(this.graphData.vertices).length > 0) {
        console.log('Real data available, loading graph');
        this.updateGraph(this.graphData);
      }
    },

    updateGraph(data) {
      if (!this.graph || !data || !data.vertices || !data.edges) {
        console.log('Cannot update graph: missing graph instance or graph data');
        return;
      }

      // Use the utility function to transform the data
      const transformedData = transformGraphDataForVisualization(data, this.nodeColors);
      
      if (!transformedData) {
        console.log('Failed to transform graph data');
        return;
      }
      
      // Set data on graph
      this.graph.setData(transformedData);

      // Emit rendering complete
      this.$emit('rendering-complete', {
        nodeCount: Object.keys(transformedData.vertices).filter(id => transformedData.vertices[id].type !== 'group').length,
        linkCount: transformedData.edges.length
      });
    },

    // Public methods for parent component
    zoomIn() {
      if (this.graph) {
        this.graph.zoomIn();
      }
    },

    zoomOut() {
      if (this.graph) {
        this.graph.zoomOut();
      }
    },

    resetView() {
      if (this.graph) {
        this.graph.resetView();
      }
    },

    resetNodePositions() {
      // Re-render with fresh layout
      if (this.graph && this.graphData) {
        this.updateGraph(this.graphData);
      }
    },

    selectNodeById(nodeId, appendToSelection = false) {
      if (this.graph) {
        this.graph.selectNodeById(nodeId, appendToSelection);
      }
    }
  }
};
</script>

<style>
#graph-container {
  width: 100%;
  height: 100%;
  background-color: #f8f9fa;
  border: 1px solid #ccc;
}
</style>