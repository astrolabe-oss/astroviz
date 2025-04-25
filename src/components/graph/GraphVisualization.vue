// src/components/graph/GraphVisualization.vue
<template>
  <div id="d3-container" ref="d3Container"></div>
</template>

<script>
import * as d3 from 'd3';
import networkIcons from '../networkIcons';
import { transformToDetailedView, transformToApplicationView, getNodeLabel } from './graphTransformUtils';

export default {
  name: 'GraphVisualization',

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
    // Node color mapping
    nodeColors: {
      type: Object,
      required: true
    }
  },

  data() {
    return {
      simulation: null,
      svg: null,
      g: null, // Main group for zoom/pan
      zoom: null,
      currentZoomLevel: 1, // Track current zoom level

      // Store current nodes and links for updates
      currentNodes: [],
      currentLinks: [],

      // Map to store fixed node positions
      nodePositions: {}
    };
  },

  computed: {
    nodeCount() {
      return this.currentNodes.length;
    },

    linkCount() {
      return this.currentLinks.length;
    }
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
    // Utility functions for graph transformations
    transformToDetailedView,
    transformToApplicationView,
    getNodeLabel,

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
              this.$emit('zoom-change', event.transform.k);
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

        // Initialize force simulation with more compact settings
        this.simulation = d3.forceSimulation()
            // Shorter link distance for more compact layout
            .force('link', d3.forceLink().id(d => d.id).distance(60))
            // Weaker repulsion force between nodes
            .force('charge', d3.forceManyBody().strength(-150))
            // Center force
            .force('center', d3.forceCenter(width / 2, height / 2))
            // Smaller collision radius
            .force('collision', d3.forceCollide().radius(25))
            // Add a radial force to keep nodes within a certain radius
            .force('radial', d3.forceRadial(Math.min(width, height) / 3, width / 2, height / 2).strength(0.05))
            .on('tick', this.tick);

        console.log("D3: Visualization initialized with compact force layout");
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

        this.$emit('rendering-start');

        let visData;

        // Transform data based on view mode
        if (this.viewMode === 'application') {
          visData = this.transformToApplicationView(this.graphData);
        } else {
          visData = this.transformToDetailedView(this.graphData);
        }

        // Store node positions before updating
        this.saveNodePositions();

        // Apply any saved positions to the new nodes
        this.applyNodePositions(visData.nodes);

        // Store current nodes and links
        this.currentNodes = visData.nodes;
        this.currentLinks = visData.links;

        // Update simulation
        this.updateSimulation(visData);

        // Notify parent component about rendering completion
        setTimeout(() => {
          this.$emit('rendering-complete', {
            nodeCount: this.currentNodes.length,
            linkCount: this.currentLinks.length
          });
        }, 1000);

        console.log("D3: Visualization updated");
      } catch (error) {
        console.error("D3: Error updating visualization", error);
        throw error;
      }
    },

    /**
     * Save current node positions
     */
    saveNodePositions() {
      this.nodePositions = {};
      if (this.currentNodes && this.currentNodes.length > 0) {
        this.currentNodes.forEach(node => {
          if (node.fx !== undefined && node.fy !== undefined) {
            this.nodePositions[node.id] = { fx: node.fx, fy: node.fy };
          }
        });
      }
      console.log("D3: Saved positions for", Object.keys(this.nodePositions).length, "nodes");
    },

    /**
     * Apply saved node positions to new nodes
     */
    applyNodePositions(nodes) {
      if (nodes && nodes.length > 0) {
        nodes.forEach(node => {
          if (this.nodePositions[node.id]) {
            node.fx = this.nodePositions[node.id].fx;
            node.fy = this.nodePositions[node.id].fy;
          }
        });
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

      // Adjust force parameters based on graph size
      const nodeCount = data.nodes.length;

      // For larger graphs, use even more compact settings
      if (nodeCount > 100) {
        const linkForce = this.simulation.force('link');
        if (linkForce) linkForce.distance(40);

        const chargeForce = this.simulation.force('charge');
        if (chargeForce) chargeForce.strength(-100);

        const collisionForce = this.simulation.force('collision');
        if (collisionForce) collisionForce.radius(20);

        const radialForce = this.simulation.force('radial');
        if (radialForce) radialForce.strength(0.1);
      } else {
        const linkForce = this.simulation.force('link');
        if (linkForce) linkForce.distance(60);

        const chargeForce = this.simulation.force('charge');
        if (chargeForce) chargeForce.strength(-150);

        const collisionForce = this.simulation.force('collision');
        if (collisionForce) collisionForce.radius(25);

        const radialForce = this.simulation.force('radial');
        if (radialForce) radialForce.strength(0.05);
      }

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

      // Add network icon shapes using SVG
      const self = this;
      node.each(function(d) {
        const nodeSize = nodeCount > 100 ? 14 : 18;
        const color = self.nodeColors[d.type] || '#ccc';

        // Create group for the icon
        const iconGroup = d3.select(this).append('g')
            .attr('transform', `translate(${-nodeSize},${-nodeSize})`)
            .attr('width', nodeSize * 2)
            .attr('height', nodeSize * 2);

        // Get the appropriate icon SVG based on node type
        const iconSvg = networkIcons[d.type] || networkIcons.default;

        // Create a temporary div to hold the SVG content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = iconSvg;

        // Extract the SVG element and its child nodes
        const svgElement = tempDiv.querySelector('svg');
        const svgContent = svgElement.innerHTML;

        // Create a new SVG element and set its attributes
        const newSvg = iconGroup.append('svg')
            .attr('width', nodeSize * 2)
            .attr('height', nodeSize * 2)
            .attr('viewBox', svgElement.getAttribute('viewBox'))
            .style('color', color) // This works with the "currentColor" fill in the icons
            .html(svgContent);
      });

      // Add text labels
      node.append('text')
          .attr('class', 'node-label')
          .attr('dx', nodeCount > 100 ? 15 : 20)
          .attr('dy', 4)
          .text(d => nodeCount > 200 ? '' : d.label)
          .attr('font-size', nodeCount > 100 ? '8px' : '10px');

      // Add tooltips
      node.append('title')
          .text(d => {
            return `Type: ${d.type}\nName: ${d.label}`;
          });

      // Update simulation
      this.simulation
          .nodes(data.nodes)
          .force('link').links(data.links);

      // Use a higher alpha for better initial layout
      this.simulation.alpha(1).alphaDecay(0.02).restart();
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
     * Create drag behavior for nodes that keeps them fixed after dragging
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
            // Keep fx and fy set to maintain the node's position
            // We no longer set d.fx = null; d.fy = null;
          });
    },

    /**
     * Reset all node positions (make them unfixed)
     */
    resetNodePositions() {
      if (this.currentNodes) {
        this.currentNodes.forEach(node => {
          node.fx = null;
          node.fy = null;
        });

        // Clear saved positions
        this.nodePositions = {};

        // Update the simulation with the unfixed nodes
        this.simulation.nodes(this.currentNodes);
        this.simulation.alpha(0.3).restart();
      }
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
      this.$emit('zoom-change', this.currentZoomLevel);
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
      this.$emit('zoom-change', this.currentZoomLevel);
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

      this.$emit('zoom-change', this.currentZoomLevel);
    }
  }
};
</script>

<style scoped>
#d3-container {
  width: 100%;
  height: 75vh;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f9f9f9;
  overflow: hidden;
}

/* Style for the nodes and links */
:deep(.link) {
  stroke-opacity: 0.6;
}

:deep(.node-label) {
  font-family: sans-serif;
  pointer-events: none;
}
</style>