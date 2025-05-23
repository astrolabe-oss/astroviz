<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div class="component-graph-container">
    <div ref="graphContainer" class="component-graph"></div>
  </div>
</template>

<script>
import * as d3 from 'd3';
import { findComponentRelationships } from '@/utils/relationshipUtils';
import { getNodeTypeColor } from '@/utils/nodeUtils';
import networkIcons from '../networkIcons';

export default {
  name: 'ComponentGraph',

  props: {
    components: {
      type: Array,
      required: true
    },
    nodeColors: {
      type: Object,
      required: true
    },
    rawGraphData: {
      type: Object,
      required: true
    }
  },

  data() {
    return {
      simulation: null,
      svg: null,
      width: 0,
      height: 0
    };
  },

  mounted() {
    this.initializeGraph();
    window.addEventListener('resize', this.handleResize);
  },

  beforeDestroy() {
    if (this.simulation) {
      this.simulation.stop();
    }
    window.removeEventListener('resize', this.handleResize);
  },

  watch: {
    components: {
      handler() {
        this.updateGraph();
      },
      deep: true
    }
  },

  methods: {
    initializeGraph() {
      const container = this.$refs.graphContainer;

      // Set dimensions
      this.width = container.clientWidth;
      this.height = 180; // Fixed height for the component graph

      // Create SVG
      this.svg = d3.select(container)
        .append('svg')
        .attr('width', this.width)
        .attr('height', this.height)
        .attr('class', 'component-graph-svg');

      // Add zoom functionality
      const zoom = d3.zoom()
        .scaleExtent([0.3, 2])
        .on('zoom', (event) => {
          this.svg.select('g').attr('transform', event.transform);
        });

      this.svg.call(zoom);

      // Create the main graph container
      this.svg.append('g')
        .attr('class', 'graph-container');

      this.updateGraph();
    },

    updateGraph() {
      if (!this.svg || !this.components || this.components.length === 0) return;

      // Filter out Application nodes as they are the parent containers
      const filteredComponents = this.components.filter(component => 
        component.nodeType !== 'Application'
      );
      
      // If no components remain after filtering, exit
      if (filteredComponents.length === 0) return;
    
      // Prepare the data
      const nodes = filteredComponents.map(component => ({
        id: component.name || component.address || 'unknown',
        type: component.nodeType,
        data: component
      }));

      // Create links between components based on type proximity
      // Use the helper function to find real relationships between components
      // based on the raw graph data
      const links = findComponentRelationships(this.components, this.rawGraphData);
      
      console.log('Nodes:', nodes);
      console.log('Links:', links);
      
      // Clear existing graph
      this.svg.select('.graph-container').selectAll('*').remove();
      
      // Create the simulation - when links use full node objects, we don't need to specify id accessor
      this.simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).distance(60))
        .force('charge', d3.forceManyBody().strength(-100))
        .force('center', d3.forceCenter(this.width / 2, this.height / 2))
        .force('collision', d3.forceCollide().radius(35)); // Increased radius to account for wrapped labels

      const g = this.svg.select('.graph-container');

      // Create the links
      const link = g.append('g')
          .attr('class', 'links')
          .selectAll('line')
          .data(links)
          .enter().append('line')
          .attr('stroke', '#ccc')
          .attr('stroke-width', 1)
          .attr('stroke-opacity', 0.6);

      // Create the node groups
      const node = g.append('g')
          .attr('class', 'nodes')
          .selectAll('g')
          .data(nodes)
          .enter().append('g')
          .attr('class', 'node')
          .call(d3.drag()
              .on('start', this.dragstarted)
              .on('drag', this.dragged)
              .on('end', this.dragended));

      // Map node types to icon keys in networkIcons
      const nodeTypeToIconKey = {
        'Application': 'Application',
        'Deployment': 'Deployment',
        'Compute': 'Compute',
        'Resource': 'Resource',
        'TrafficController': 'TrafficController',
        // Add more mappings as needed
      };

      // Add icons for nodes using networkIcons - directly, without background circles
      node.each(function(d) {
        const nodeGroup = d3.select(this);
        const color = getNodeTypeColor(d.type);

        // Map the node type to the correct key in networkIcons
        // If not found, fall back to node type directly or default
        const iconKey = nodeTypeToIconKey[d.type] || d.type;
        const iconSvg = networkIcons[iconKey] || networkIcons.default;

        // Create a container for the SVG icon
        const iconContainer = nodeGroup.append('foreignObject')
            .attr('width', 30)
            .attr('height', 30)
            .attr('x', -15)
            .attr('y', -15)
            .attr('pointer-events', 'none');

        const iconDiv = iconContainer.append('xhtml:div')
            .style('width', '100%')
            .style('height', '100%')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('justify-content', 'center');

        // Set the SVG with the current node color
        const coloredSvg = iconSvg.replace('<svg', `<svg style="width: 30px; height: 30px; color: ${color}"`);
        iconDiv.html(coloredSvg);
        
        // Add node label showing address and protocol_multiplexor
        const component = d.data;
        if (component) {
          // Format label as "address (protocol_multiplexor)"
          const address = component.address || component.name || 'Unknown';
          const protocolMux = component.protocol_multiplexor || 'Unknown';
          const labelText = `${address}:${protocolMux}`;
          
          // Handle text wrapping for long labels
          const wrapText = (text, maxCharsPerLine = 15) => {
            if (text.length <= maxCharsPerLine) return [text];
            
            const words = text.split(' ');
            const lines = [];
            let currentLine = '';
            
            words.forEach(word => {
              // If adding this word would exceed the max chars
              if ((currentLine + ' ' + word).length > maxCharsPerLine && currentLine !== '') {
                lines.push(currentLine);
                currentLine = word;
              } else {
                currentLine = currentLine === '' ? word : currentLine + ' ' + word;
              }
            });
            
            if (currentLine !== '') lines.push(currentLine);
            
            // For very long single words, break them
            return lines.map(line => {
              if (line.length <= maxCharsPerLine) return line;
              
              const chunks = [];
              for (let i = 0; i < line.length; i += maxCharsPerLine) {
                chunks.push(line.substring(i, i + maxCharsPerLine));
              }
              return chunks;
            }).flat();
          };
          
          const wrappedText = wrapText(labelText);
          
          // Create a label group
          const labelGroup = nodeGroup.append('g')
            .attr('class', 'node-label-group');
            
          // Add each line of text
          wrappedText.forEach((line, i) => {
            labelGroup.append('text')
              .attr('dy', 25 + (i * 12)) // Position each line below previous, starting 25px below node
              .attr('text-anchor', 'middle')
              .attr('class', 'node-label')
              .attr('fill', '#333')
              .attr('font-size', '10px')
              .text(line);
          });
        }
      });
      
      // Add title for tooltips
      node.append('title')
          .text(d => {
            const component = d.data;
            let tooltip = `${component.nodeType}: ${component.name || 'Unnamed'}`;
      
            if (component.address) {
              tooltip += `\nAddress: ${component.address}`;
            }
      
            if (component.protocol_multiplexor) {
              tooltip += `\nMux: ${component.protocol_multiplexor}`;
            }
      
            return tooltip;
          });
      
      // Add labels to links showing the link type/name
      const linkLabels = g.append("g")
        .attr("class", "link-labels")
        .selectAll("text")
        .data(links)
        .enter().append("text")
        .attr("font-size", "8px")
        .attr("fill", "#666")
        .attr("text-anchor", "middle")
        .text(d => d.type + "-" + d.type);

      console.log('Link Data:', links);
      // Update simulation on tick
      this.simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
            
        // Update link label positions
        linkLabels
            .attr("x", d => (d.source.x + d.target.x) / 2)
            .attr("y", d => (d.source.y + d.target.y) / 2 - 5); // Position slightly above the link line

        node.attr('transform', d => {
          // Keep nodes within bounds
          d.x = Math.max(20, Math.min(this.width - 20, d.x));
          d.y = Math.max(20, Math.min(this.height - 20, d.y));
          return `translate(${d.x}, ${d.y})`;
        });
      });
    },

    dragstarted(event, d) {
      if (!event.active) this.simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    },

    dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    },

    dragended(event, d) {
      if (!event.active) this.simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    },

    handleResize() {
      if (!this.$refs.graphContainer) return;

      this.width = this.$refs.graphContainer.clientWidth;

      if (this.svg) {
        this.svg
          .attr('width', this.width)
          .attr('height', this.height);

        // Update simulation center force
        if (this.simulation) {
          this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2));
          this.simulation.alpha(0.3).restart();
        }
      }
    }
  }
};
</script>

<style scoped>
.component-graph-container {
  width: 100%;
  height: 180px;
  position: relative;
  margin-bottom: 10px;
  overflow: hidden;
  background-color: #f8f9fa;
  border-radius: 6px;
}

.component-graph {
  width: 100%;
  height: 100%;
}

:deep(.component-graph-svg) {
  display: block;
  background-color: #f8f9fa;
  border-radius: 6px;
}

:deep(.node) {
  cursor: pointer;
}

:deep(.links line) {
  stroke-opacity: 0.5;
}

:deep(.node-label) {
  pointer-events: none;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8), 0 -1px 2px rgba(255, 255, 255, 0.8), 1px 0 2px rgba(255, 255, 255, 0.8), -1px 0 2px rgba(255, 255, 255, 0.8);
  font-weight: 500;
  line-height: 1.2;
}

:deep(.node-label-group) {
  pointer-events: none;
}

:deep(.link-labels text) {
  pointer-events: none;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8), 0 -1px 2px rgba(255, 255, 255, 0.8), 1px 0 2px rgba(255, 255, 255, 0.8), -1px 0 2px rgba(255, 255, 255, 0.8);
  font-weight: 500;
}
</style>
<style scoped>
.component-graph-container {
  width: 100%;
  height: 180px;
  position: relative;
  margin-bottom: 10px;
  overflow: hidden;
  background-color: #f8f9fa;
  border-radius: 6px;
}

.component-graph {
  width: 100%;
  height: 100%;
}

:deep(.component-graph-svg) {
  display: block;
  background-color: #f8f9fa;
  border-radius: 6px;
}
</style>
