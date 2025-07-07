<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div id="cy" class="cytoscape-widget"></div>
</template>

<script>
import cytoscape from 'cytoscape';

export default {
  name: 'GraphVisualization',

  props: {
    graphData: {
      type: Object,
      required: true,
      default: () => ({ vertices: {}, edges: [] })
    },
    viewMode: {
      type: String,
      required: true,
      default: 'detailed'
    },
    nodeColors: {
      type: Object,
      required: true
    },
    filters: {
      type: Object,
      default: () => ({})
    }
  },

  data() {
    return {
      $cy: null
    };
  },

  mounted() {
    console.log('GraphVisualization mounted, waiting for DOM...');
    this.$nextTick(() => {
      console.log('DOM ready, initializing Cytoscape');
      this.initializeCytoscape();
    });
  },

  beforeDestroy() {
    if (this.$cy) {
      console.log('Destroying Cytoscape instance');
      this.$cy.destroy();
    }
  },

  watch: {
    graphData: {
      handler(newData) {
        console.log('GraphData changed, updating graph');
        this.updateGraph(newData);
      },
      deep: true
    }
  },

  methods: {
    initializeCytoscape() {
      console.log('Initializing Cytoscape with dummy data');
      
      // Check if container exists
      const container = document.getElementById('cy');
      if (!container) {
        console.error('Container element #cy not found!');
        return;
      }
      console.log('Container found:', container);
      
      console.log('Creating Cytoscape instance...');
      this.$cy = cytoscape({
        container: container,
        
        style: [
          {
            selector: 'node',
            style: {
              'background-color': 'data(color)',
              'label': 'data(label)',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '8px',
              'width': 20,
              'height': 20,
              'color': '#000',
              'text-outline-width': 1,
              'text-outline-color': '#fff'
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 1,
              'line-color': '#ccc',
              'target-arrow-color': '#ccc',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier'
            }
          }
        ],
        
      });

      // Set up event handlers
      this.$cy.on('tap', 'node', (event) => {
        const node = event.target;
        const nodeData = node.data();
        if (nodeData.originalData) {
          this.$emit('node-clicked', nodeData.originalData, event.originalEvent.shiftKey);
        }
      });

      this.$cy.on('zoom', () => {
        this.$emit('zoom-change', this.$cy.zoom());
      });

      console.log('Cytoscape initialized successfully');
      
      // Load real data if available
      if (this.graphData && this.graphData.vertices && Object.keys(this.graphData.vertices).length > 0) {
        console.log('Real data available, loading graph');
        this.updateGraph(this.graphData);
      }
    },

    updateGraph(graphData) {
      if (!this.$cy || !graphData || !graphData.vertices || !graphData.edges) {
        console.log('Cannot update graph: missing cy instance or graph data');
        return;
      }

      console.log(`Updating graph with ${Object.keys(graphData.vertices).length} nodes and ${graphData.edges.length} edges`);
      
      // Stop any running layouts first
      try {
        this.$cy.stop();
      } catch (e) {
        // Ignore errors if no layout is running
      }
      
      // Clear existing elements
      this.$cy.elements().remove();
      
      // Create elements array
      const elements = [];
      
      // Add all nodes
      Object.entries(graphData.vertices).forEach(([id, vertex]) => {
        elements.push({
          data: {
            id: id,
            label: this.getNodeLabel(vertex),
            color: this.getNodeColor(vertex.type),
            type: vertex.type,
            originalData: vertex
          }
        });
      });

      // Add all edges
      graphData.edges.forEach((edge, index) => {
        elements.push({
          data: {
            id: `edge-${index}`,
            source: edge.start_node,
            target: edge.end_node,
            edgeType: edge.type
          }
        });
      });

      console.log(`Adding ${elements.length} elements to graph`);
      
      // Add elements to cytoscape
      this.$cy.add(elements);
      
      // Apply force-directed layout with error handling
      console.log('Applying cose layout...');
      const layoutOptions = {
        name: 'fcose',
        fit: true,
        padding: 100,
        nodeRepulsion: 10000,
        nodeOverlap: 25,
        idealEdgeLength: 180,
        edgeElasticity: 0.3,
        nestingFactor: 0.1,
        gravity: 0.1,
        numIter: 3000,
        animate: false, // Disable animation to prevent errors
        randomize: true,
        // fcose specific options for large graphs
        quality: 'default',
        samplingType: true,
        sampleSize: 25,
        nodeSeparation: 75
      };
      
      console.log('Layout options:', layoutOptions);
      console.log('Container dimensions:', this.$cy.container().offsetWidth, 'x', this.$cy.container().offsetHeight);
      
      try {
        const layout = this.$cy.layout(layoutOptions);
        
        layout.run();
        
        // Auto zoom out to show full spread after layout
        setTimeout(() => {
          this.$cy.fit();
          this.$cy.zoom(this.$cy.zoom() * 0.8); // Zoom out 20% more to see spacing
          this.$cy.center();
          console.log('Layout completed and zoomed out for better view');
        }, 100);
        
        // Emit rendering complete immediately since no animation
        this.$emit('rendering-complete', {
          nodeCount: this.$cy.nodes().length,
          linkCount: this.$cy.edges().length
        });
        
      } catch (error) {
        console.error('Layout failed:', error);
        // Fallback to fit view
        this.$cy.fit();
      }
    },

    getNodeLabel(vertex) {
      const type = vertex.type;
      if (type === 'Application') return vertex.name || `App: ${vertex.app_name || 'Unknown'}`;
      if (type === 'Deployment') return vertex.name || `Deploy: ${vertex.app_name || 'Unknown'}`;
      if (type === 'Compute') return `${vertex.name || 'Compute'}${vertex.address ? ` (${vertex.address})` : ''}`;
      if (type === 'Resource') return `${vertex.name || 'Resource'}${vertex.address ? ` (${vertex.address})` : ''}`;
      if (type === 'TrafficController') return `${vertex.name || 'Traffic'}${vertex.address ? ` (${vertex.address})` : ''}`;
      if (type === 'InternetIP') return `${vertex.address || 'IP'}`;
      return vertex.name || vertex.type;
    },

    getNodeColor(type) {
      return this.nodeColors[type] || '#999';
    },

    // Public methods for parent component
    zoomIn() {
      if (this.cy) {
        this.cy.zoom(this.cy.zoom() * 1.3);
        this.cy.center();
      }
    },

    zoomOut() {
      if (this.cy) {
        this.cy.zoom(this.cy.zoom() * 0.7);
        this.cy.center();
      }
    },

    resetView() {
      if (this.cy) {
        this.cy.fit();
      }
    },

    resetNodePositions() {
      if (this.cy) {
        const layout = this.cy.layout({ 
          name: 'cose',
          fit: true,
          padding: 30,
          nodeRepulsion: 4500,
          idealEdgeLength: 100,
          edgeElasticity: 0.45,
          nestingFactor: 0.1,
          gravity: 0.25,
          numIter: 2500,
          animate: 'end',
          animationDuration: 1000,
          randomize: false
        });
        layout.run();
      }
    }
  }
};
</script>

<style>
#cy {
  width: 100vw;
  height: 100vh;
  background-color: #f8f9fa;
  border: 1px solid #ccc;
}
</style>