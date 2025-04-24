// D3NetworkGraph.vue
<template>
  <div class="network-graph">
    <div class="rendering-status" v-if="isRendering">
      <div class="spinner"></div>
      <span>Rendering {{ nodeCount }} nodes and {{ edgeCount }} connections...</span>
    </div>
    <div class="controls">
      <button @click="zoomIn" class="control-btn" title="Zoom In">+</button>
      <button @click="zoomOut" class="control-btn" title="Zoom Out">−</button>
      <div class="zoom-level" v-if="currentZoomLevel">{{ Math.round(currentZoomLevel * 100) }}%</div>
      <button @click="resetView" class="control-btn" title="Reset View">⟳</button>
    </div>
    <div id="d3-container" ref="d3Container"></div>
    <div class="legend">
      <div v-for="(color, type) in nodeColors" :key="type" class="legend-item">
        <div class="legend-color" :style="{backgroundColor: color}"></div>
        <div class="legend-label">{{ type }}</div>
      </div>
    </div>
    <div class="graph-stats" v-if="showStats">
      <div>Nodes: {{ nodeCount }}</div>
      <div>Connections: {{ edgeCount }}</div>
    </div>
  </div>
</template>

<script>
import * as d3 from 'd3';

export default {
  name: 'D3NetworkGraph',

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
    }
  },

  data() {
    return {
      simulation: null,
      svg: null,
      g: null, // Main group for zoom/pan
      zoom: null,
      currentZoomLevel: 1, // Track current zoom level

      nodeColors: {
        'Application': '#6DB33F',
        'Deployment': '#1E88E5',
        'Compute': '#FFA726',
        'Resource': '#7E57C2',
        'TrafficController': '#26A69A',
        'InternetIP': '#EC407A'
      },

      isRendering: false,
      nodeCount: 0,
      edgeCount: 0,
      showStats: false,

      // Store current nodes and links for updates
      currentNodes: [],
      currentLinks: []
    };
  },

  watch: {
    // Update visualization when graph data or view mode changes
    graphData: {
      handler(newVal) {
        console.log("D3: Graph data changed");
        try {
          if (newVal && newVal.vertices && Object.keys(newVal.vertices).length > 0) {
            this.updateVisualization();
          }
        } catch (error) {
          console.error("D3: Error in graphData watcher", error);
        }
      },
      deep: true
    },
    viewMode() {
      console.log("D3: View mode changed");
      try {
        if (this.graphData && this.graphData.vertices &&
            Object.keys(this.graphData.vertices).length > 0) {
          this.updateVisualization();
        }
      } catch (error) {
        console.error("D3: Error in viewMode watcher", error);
      }
    }
  },

  mounted() {
    // Initialize D3 visualization
    try {
      this.initD3();

      // Update with initial data if available
      if (this.graphData.vertices && Object.keys(this.graphData.vertices).length > 0) {
        this.updateVisualization();
      }

      // Handle window resize
      window.addEventListener('resize', this.onResize);
    } catch (error) {
      console.error("D3: Error in mounted", error);
    }
  },

  beforeDestroy() {
    // Clean up
    window.removeEventListener('resize', this.onResize);

    if (this.simulation) {
      this.simulation.stop();
    }
  },

  methods: {
    /**
     * Initialize the D3 visualization
     */
    initD3() {
      try {
        console.log("D3: Initializing visualization");
        const container = this.$refs.d3Container;
        const width = container.clientWidth;
        const height = container.clientHeight || 600;

        // Create SVG element
        this.svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        // Create zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 5])
            .on('zoom', (event) => {
              // Update current zoom level
              this.currentZoomLevel = event.transform.k;
              this.g.attr('transform', event.transform);
            });

        // Apply zoom to the SVG
        this.svg.call(this.zoom);

        // Create a group for the graph elements
        this.g = this.svg.append('g');

        // Create arrow marker definition
        this.svg.append('defs').append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '-0 -5 10 10')
            .attr('refX', 20)
            .attr('refY', 0)
            .attr('orient', 'auto')
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('xoverflow', 'visible')
            .append('svg:path')
            .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
            .attr('fill', '#999')
            .style('stroke', 'none');

        // Initialize force simulation
        this.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(40))
            .on('tick', this.tick);

        console.log("D3: Visualization initialized");
      } catch (error) {
        console.error("D3: Error initializing D3", error);
        throw error;
      }
    },

    /**
     * Update the visualization based on current graph data and view mode
     */
    updateVisualization() {
      try {
        console.log("D3: Updating visualization");
        if (!this.svg || !this.graphData.vertices || Object.keys(this.graphData.vertices).length === 0) {
          console.log("D3: Nothing to visualize");
          return;
        }

        // Reset stats
        this.showStats = false;
        this.isRendering = true;

        let visData;

        // Transform data based on view mode
        if (this.viewMode === 'application') {
          visData = this.transformToApplicationView(this.graphData);
        } else {
          visData = this.transformToDetailedView(this.graphData);
        }

        // Update node and edge counts
        this.nodeCount = visData.nodes.length;
        this.edgeCount = visData.links.length;

        console.log("D3: Setting visualization data", this.nodeCount, "nodes,", this.edgeCount, "links");

        // Store current nodes and links
        this.currentNodes = visData.nodes;
        this.currentLinks = visData.links;

        // Update simulation
        this.updateSimulation(visData);

        // Show stats after rendering
        setTimeout(() => {
          this.isRendering = false;
          this.showStats = true;
        }, 1000);

        console.log("D3: Visualization updated");
      } catch (error) {
        console.error("D3: Error updating visualization", error);
        throw error;
      }
    },

    /**
     * Update D3 force simulation with new data
     * @param {Object} data The visualization data (nodes and links)
     */
    updateSimulation(data) {
      // Clear existing elements
      this.g.selectAll('.link').remove();
      this.g.selectAll('.node').remove();
      this.g.selectAll('.node-label').remove();

      // Create links
      const link = this.g.selectAll('.link')
          .data(data.links)
          .enter()
          .append('line')
          .attr('class', 'link')
          .attr('stroke-width', 1.5)
          .attr('stroke', '#999')
          .attr('marker-end', 'url(#arrowhead)');

      // Create node groups
      const node = this.g.selectAll('.node')
          .data(data.nodes)
          .enter()
          .append('g')
          .attr('class', 'node')
          .call(this.drag())
          .on('click', (event, d) => this.onNodeClick(d));

      // Add circles to node groups
      node.append('circle')
          .attr('r', 12)
          .attr('fill', d => this.nodeColors[d.type] || '#ccc')
          .attr('stroke', d => d3.color(this.nodeColors[d.type] || '#ccc').darker())
          .attr('stroke-width', 1.5);

      // Add text labels
      node.append('text')
          .attr('class', 'node-label')
          .attr('dx', 15)
          .attr('dy', 4)
          .text(d => d.label)
          .attr('font-size', '10px');

      // Add tooltips
      node.append('title')
          .text(d => {
            return `Type: ${d.type}\nName: ${d.label}`;
          });

      // Update simulation
      this.simulation
          .nodes(data.nodes)
          .force('link').links(data.links);

      // Restart simulation
      this.simulation.alpha(1).restart();
    },

    /**
     * Simulation tick function to update positions
     */
    tick() {
      this.g.selectAll('.link')
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

      this.g.selectAll('.node')
          .attr('transform', d => `translate(${d.x},${d.y})`);
    },

    /**
     * Create drag behavior for nodes
     */
    drag() {
      return d3.drag()
          .on('start', (event, d) => {
            if (!event.active) this.simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) this.simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          });
    },

    /**
     * Transform graph data to detailed view
     * @param {Object} graphData The filtered graph data
     * @returns {Object} Transformed data for visualization
     */
    transformToDetailedView(graphData) {
      console.log("D3: transformToDetailedView called");

      // Create nodes for visualization
      const nodes = [];
      Object.entries(graphData.vertices).forEach(([id, vertex]) => {
        nodes.push({
          id,
          label: this.getNodeLabel(vertex),
          type: vertex.type,
          data: vertex  // Store all vertex data for reference
        });
      });

      // Create links for visualization
      const links = [];
      graphData.edges.forEach(edge => {
        links.push({
          source: edge.start_node,
          target: edge.end_node,
          type: edge.type
        });
      });

      console.log(`D3: Detailed view has ${nodes.length} nodes and ${links.length} links`);
      return { nodes, links };
    },

    /**
     * Transform graph data to application level view
     * @param {Object} graphData The filtered graph data
     * @returns {Object} Transformed data for visualization
     */
    transformToApplicationView(graphData) {
      console.log("D3: transformToApplicationView called");

      const appNodes = {};
      const deploymentToAppMap = {};
      const computeToAppMap = {};

      // First pass - identify all Applications and create nodes
      Object.entries(graphData.vertices).forEach(([id, vertex]) => {
        if (vertex.type === 'Application') {
          appNodes[id] = {
            id,
            label: vertex.name || `App: ${vertex.app_name || id}`,
            type: 'Application',
            data: vertex
          };
        }
      });

      // Second pass - find deployment-to-application relationships
      graphData.edges.forEach(edge => {
        if (edge.type === 'IMPLEMENTS') {
          deploymentToAppMap[edge.start_node] = edge.end_node;
        }
      });

      // Third pass - find compute-to-deployment relationships
      graphData.edges.forEach(edge => {
        if (edge.type === 'MEMBER_OF') {
          const deploymentId = edge.end_node;
          const appId = deploymentToAppMap[deploymentId];
          if (appId) {
            computeToAppMap[edge.start_node] = appId;
          }
        }
      });

      // Fourth pass - create app-to-app connections based on compute connections
      const appConnections = {};
      graphData.edges.forEach(edge => {
        if (edge.type === 'CALLS') {
          const sourceAppId = computeToAppMap[edge.start_node];
          const targetAppId = computeToAppMap[edge.end_node];

          if (sourceAppId && targetAppId && sourceAppId !== targetAppId) {
            const connKey = `${sourceAppId}-${targetAppId}`;
            appConnections[connKey] = {
              source: sourceAppId,
              target: targetAppId,
              type: 'CALLS'
            };
          }
        }
      });

      const nodes = Object.values(appNodes);
      const links = Object.values(appConnections);

      console.log(`D3: Application view has ${nodes.length} nodes and ${links.length} links`);
      return { nodes, links };
    },

    /**
     * Create a meaningful label for a node based on its type and properties
     * @param {Object} vertex The vertex data
     * @returns {string} A label for display
     */
    getNodeLabel(vertex) {
      const type = vertex.type;

      if (type === 'Application') {
        return vertex.name || `App: ${vertex.app_name || 'Unknown'}`;
      }
      if (type === 'Deployment') {
        return vertex.name || `Deploy: ${vertex.app_name || 'Unknown'}`;
      }
      if (type === 'Compute') {
        return `${vertex.name || 'Compute'}${vertex.address ? ` (${vertex.address})` : ''}`;
      }
      if (type === 'Resource') {
        return `${vertex.name || 'Resource'}${vertex.address ? ` (${vertex.address})` : ''}`;
      }
      if (type === 'TrafficController') {
        return `${vertex.name || 'Traffic'}${vertex.address ? ` (${vertex.address})` : ''}`;
      }
      if (type === 'InternetIP') {
        return `${vertex.address || 'IP'}`;
      }

      // Default
      return vertex.name || vertex.type;
    },

    /**
     * Handle node click event
     * @param {Object} node The clicked node data
     */
    onNodeClick(node) {
      // Emit node clicked event
      this.$emit('node-clicked', node.data);
    },

    /**
     * Handle window resize
     */
    onResize() {
      const container = this.$refs.d3Container;
      const width = container.clientWidth;
      const height = container.clientHeight || 600;

      // Update SVG viewBox
      this.svg
          .attr('viewBox', `0 0 ${width} ${height}`)
          .attr('width', '100%')
          .attr('height', '100%');

      // Update simulation center force
      if (this.simulation) {
        this.simulation
            .force('center', d3.forceCenter(width / 2, height / 2))
            .alpha(0.3)
            .restart();
      }
    },

    /**
     * Zoom in on the visualization
     */
    zoomIn() {
      // Use d3's built-in zoom handling with smooth transition
      this.svg.transition().duration(300).call(
          this.zoom.scaleBy, 1.2
      );
      this.currentZoomLevel *= 1.2;
    },

    /**
     * Zoom out on the visualization
     */
    zoomOut() {
      // Use d3's built-in zoom handling with smooth transition
      this.svg.transition().duration(300).call(
          this.zoom.scaleBy, 0.8
      );
      this.currentZoomLevel *= 0.8;
    },

    /**
     * Reset zoom and pan to default
     */
    resetView() {
      const container = this.$refs.d3Container;
      const width = container.clientWidth;
      const height = container.clientHeight || 600;

      // Reset zoom level
      this.currentZoomLevel = 0.5;

      this.svg.transition().duration(500).call(
          this.zoom.transform,
          d3.zoomIdentity.translate(width / 3, height / 3).scale(0.5)
      );
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

#d3-container {
  width: 100%;
  height: 75vh;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f9f9f9;
  overflow: hidden;
}

.rendering-status {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 10px 15px;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  z-index: 10;
  font-size: 14px;
  pointer-events: none;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 10px;
}

.controls {
  position: absolute;
  top: 10px;
  left: 15px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 5px;
  background-color: rgba(255, 255, 255, 0.85);
  padding: 5px;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.control-btn {
  font-size: 16px;
  font-weight: bold;
  width: 32px;
  height: 30px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.control-btn:hover {
  background-color: #f0f0f0;
}

.zoom-level {
  font-size: 12px;
  min-width: 40px;
  text-align: center;
  user-select: none;
}

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
  margin-bottom: 5px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
}

.legend-label {
  font-size: 12px;
}

.graph-stats {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 8px 12px;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  font-size: 12px;
  z-index: 10;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Style for the nodes and links */
:deep(.link) {
  stroke-opacity: 0.6;
}

:deep(.node circle) {
  stroke-width: 1.5px;
}

:deep(.node-label) {
  font-family: sans-serif;
  pointer-events: none;
}
</style>