<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

<template>
  <cytoscape :config="config" @afterCreated="onAfterCreated" class="cytoscape-widget">
    <cy-element
      v-for="element in elements"
      :key="element.data.id"
      :definition="element"
    />
  </cytoscape>
</template>

<script>
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
      cy: null
    };
  },

  computed: {
    config() {
      return {
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
            selector: '.boundary-node',
            style: {
              'width': 600,
              'height': 600,
              'shape': 'ellipse',
              'background-opacity': 0,
              'border-width': 3,
              'border-style': 'dashed',
              'border-color': '#4A98E3',
              'border-opacity': 0.8,
              'label': 'data(label)',
              'text-valign': 'top',
              'text-margin-y': -320,
              'font-size': '14px',
              'font-weight': 'bold',
              'color': '#4A98E3',
              'events': 'no',
              'z-index': -1
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
          },
          {
            selector: ':parent',
            style: {
              'background-opacity': 0.2,
              'background-color': 'data(color)',
              'border-width': 5,
              'border-style': 'solid',
              'border-color': 'data(color)',
              'border-opacity': 0.9,
              'label': 'data(label)',
              'text-valign': 'top',
              'text-halign': 'center',
              'font-size': '16px',
              'font-weight': 'bold',
              'color': '#333',
              'text-margin-y': -20,
              'padding': 30,
              'shape': 'roundrectangle'
            }
          }
        ],
        layout: this.layoutConfig
      };
    },
    
    elements() {
      console.log(`Computing elements for ${this.viewMode} view`);
      
      if (!this.graphData || !this.graphData.vertices || !this.graphData.edges) {
        console.log('No graph data available');
        return [];
      }

      if (this.viewMode === 'application') {
        return this.createCompoundNodeElements();
      } else {
        return this.createDetailedElements();
      }
    },
    
    layoutConfig() {
      // Use preset layout for detailed view (manual positioning)
      // Use cose-bilkent for application view (compound nodes)
      if (this.viewMode === 'detailed') {
        return {
          name: 'preset',
          fit: true,
          padding: 100
        };
      } else {
        return {
          name: 'cose-bilkent',
          fit: true,
          padding: 80,
          nodeOverlap: 20,
          idealEdgeLength: 80,
          edgeElasticity: 0.45,
          nestingFactor: 0.1,
          gravity: 0.25,
          gravityCompound: 1.5,
          gravityRangeCompound: 2.0,
          numIter: 2500,
          initialTemp: 200,
          coolingFactor: 0.95,
          minTemp: 1.0,
          nodeRepulsion: 5000,
          tile: true,
          animate: 'end',
          animationDuration: 1000,
          randomize: false,
          tilingPaddingVertical: 40,
          tilingPaddingHorizontal: 40
        };
      }
    }
  },

  methods: {
    createDetailedElements() {
      console.log('Creating detailed view with public/private boundary visualization');
      const elements = [];
      
      // Center of the visualization
      const centerX = 500;
      const centerY = 400;
      
      // Radii for positioning
      const innerRadius = 250; // Private nodes inside this circle
      const outerRadius = 400; // Public nodes outside inner circle
      const boundaryRadius = 300; // Visual boundary between public/private
      
      // First, classify nodes as public or private
      const publicNodes = [];
      const privateNodes = [];
      
      Object.entries(this.graphData.vertices).forEach(([id, vertex]) => {
        // Same logic as compound view for detecting public nodes
        const isPublic = vertex.public_ip === true || vertex.public_ip === 'true' || 
                         vertex.publicIp === true || vertex.publicIp === 'true' ||
                         vertex.is_public === true || vertex.is_public === 'true' ||
                         vertex.type === 'InternetIP';
        
        if (isPublic) {
          publicNodes.push({ id, vertex });
        } else {
          privateNodes.push({ id, vertex });
        }
      });
      
      console.log(`Classified nodes: ${privateNodes.length} private, ${publicNodes.length} public`);
      
      // Create a visual boundary circle (as a special node)
      elements.push({
        data: {
          id: 'boundary-circle',
          label: 'Internet Boundary',
          type: 'boundary',
          color: 'transparent'
        },
        position: { x: centerX, y: centerY },
        classes: 'boundary-node'
      });
      
      // Position private nodes inside the circle
      privateNodes.forEach(({ id, vertex }, index) => {
        const angle = (index * 2 * Math.PI) / privateNodes.length;
        const r = innerRadius * (0.5 + Math.random() * 0.4); // Vary radius for better distribution
        
        elements.push({
          data: {
            id: id,
            label: this.getNodeLabel(vertex),
            color: this.getNodeColor(vertex.type),
            type: vertex.type,
            originalData: vertex
          },
          position: {
            x: centerX + Math.cos(angle) * r,
            y: centerY + Math.sin(angle) * r
          }
        });
      });
      
      // Position public nodes outside the circle
      publicNodes.forEach(({ id, vertex }, index) => {
        const angle = (index * 2 * Math.PI) / publicNodes.length;
        const r = outerRadius + (Math.random() * 100); // Vary radius for natural look
        
        elements.push({
          data: {
            id: id,
            label: this.getNodeLabel(vertex),
            color: this.getNodeColor(vertex.type),
            type: vertex.type,
            originalData: vertex
          },
          position: {
            x: centerX + Math.cos(angle) * r,
            y: centerY + Math.sin(angle) * r
          }
        });
      });

      // Add edges
      this.graphData.edges.forEach((edge, index) => {
        elements.push({
          data: {
            id: `edge-${index}`,
            source: edge.start_node,
            target: edge.end_node,
            edgeType: edge.type
          }
        });
      });

      console.log(`Generated detailed view: ${elements.length} elements (${privateNodes.length} private + ${publicNodes.length} public + 1 boundary + ${this.graphData.edges.length} edges)`);
      return elements;
    },

    createCompoundNodeElements() {
      console.log('Creating simple 2-level compound hierarchy: Public/Private boundaries only');
      const elements = [];
      
      // Debug: Log sample vertex properties to understand data structure
      const sampleVertex = Object.values(this.graphData.vertices)[0];
      console.log('Sample vertex properties:', Object.keys(sampleVertex));
      console.log('Sample vertex:', sampleVertex);
      
      // Group nodes by public_ip only (simple 2-level structure)
      const publicGroups = { public: [], private: [] };
      Object.entries(this.graphData.vertices).forEach(([id, vertex]) => {
        // Debug multiple possible property names for public IP
        const isPublic = vertex.public_ip === true || vertex.public_ip === 'true' || 
                         vertex.publicIp === true || vertex.publicIp === 'true' ||
                         vertex.is_public === true || vertex.is_public === 'true' ||
                         vertex.type === 'InternetIP';
        
        console.log(`Node ${id} (${vertex.type}): public_ip=${vertex.public_ip}, type=${vertex.type} → ${isPublic ? 'public' : 'private'}`);
        publicGroups[isPublic ? 'public' : 'private'].push({ id, vertex });
      });

      console.log(`Final grouping: ${publicGroups.public.length} public nodes, ${publicGroups.private.length} private nodes`);
      
      // Create Level 1: Public/Private boundary containers
      if (publicGroups.public.length > 0) {
        elements.push({
          data: {
            id: 'public-boundary',
            label: `Public Network (${publicGroups.public.length} nodes)`,
            type: 'PublicBoundary',
            color: '#FF6B6B'
          }
        });
      }

      if (publicGroups.private.length > 0) {
        elements.push({
          data: {
            id: 'private-boundary', 
            label: `Private Infrastructure (${publicGroups.private.length} nodes)`,
            type: 'PrivateBoundary',
            color: '#4ECDC4'
          }
        });
      }

      // Create Level 2: Add all nodes directly as children of boundaries
      let nodeIndex = 0;
      
      // Add public nodes to public boundary
      publicGroups.public.forEach(({ id, vertex }) => {
        const angle = (nodeIndex * 2 * Math.PI) / publicGroups.public.length;
        const radius = Math.max(50, publicGroups.public.length * 2);
        
        elements.push({
          data: {
            id: id,
            label: this.getNodeLabel(vertex),
            color: this.getNodeColor(vertex.type),
            type: vertex.type,
            parent: 'public-boundary',
            originalData: vertex
          },
          position: {
            x: Math.cos(angle) * radius + 300,
            y: Math.sin(angle) * radius + 200
          }
        });
        nodeIndex++;
      });

      // Add private nodes to private boundary
      nodeIndex = 0;
      publicGroups.private.forEach(({ id, vertex }) => {
        const angle = (nodeIndex * 2 * Math.PI) / publicGroups.private.length;
        const radius = Math.max(100, publicGroups.private.length * 1.5);
        
        elements.push({
          data: {
            id: id,
            label: this.getNodeLabel(vertex),
            color: this.getNodeColor(vertex.type),
            type: vertex.type,
            parent: 'private-boundary',
            originalData: vertex
          },
          position: {
            x: Math.cos(angle) * radius + 600,
            y: Math.sin(angle) * radius + 400
          }
        });
        nodeIndex++;
      });

      // Add edges
      this.graphData.edges.forEach((edge, index) => {
        elements.push({
          data: {
            id: `edge-${index}`,
            source: edge.start_node,
            target: edge.end_node,
            edgeType: edge.type
          }
        });
      });

      console.log(`Generated simple 2-level hierarchy: ${elements.length} elements (${publicGroups.public.length + publicGroups.private.length} nodes, ${this.graphData.edges.length} edges)`);
      return elements;
    },

    onAfterCreated(cy) {
      console.log('Cytoscape created with', cy.elements().length, 'elements');
      this.cy = cy;
      
      // Set up event handlers
      cy.on('tap', 'node', (event) => {
        const node = event.target;
        const nodeData = node.data();
        this.$emit('node-clicked', nodeData.originalData, event.originalEvent.shiftKey);
      });

      cy.on('zoom', () => {
        this.$emit('zoom-change', cy.zoom());
      });

      // Emit rendering complete
      this.$emit('rendering-complete', {
        nodeCount: cy.nodes().length,
        linkCount: cy.edges().length
      });
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
          name: 'cose-bilkent',
          fit: true,
          padding: 30,
          nodeRepulsion: 4500,
          idealEdgeLength: 100,
          edgeElasticity: 0.45,
          nestingFactor: 0.1,
          gravity: 0.25,
          numIter: 2500,
          tile: true,
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

<style scoped>
.cytoscape-widget {
  width: 100%;
  height: 100%;
  background-color: #f8f9fa;
}
</style>