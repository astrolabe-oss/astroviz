<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

// src/components/graph/GraphVisualization.vue
<template>
  <div id="d3-container" ref="d3Container"></div>
</template>

      // Add secondary cloud icon for nodes with public_ip = true
      this.addSecondaryIcons(node);

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
    },
    // Set of node IDs that should be highlighted
    highlightedNodeIds: {
      type: Set,
      default: () => new Set()
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
      nodePositions: {},

      // Track the selected node ID
      selectedNodeId: null,

      // Store node colors for restoration
      nodeOriginalColors: {},
      
      // Node size for rendering
      nodeSize: 18
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
    },
    highlightedNodeIds: {
      handler(newVal) {
        console.log("D3: Highlighted nodes changed", newVal?.size);
        try {
          // Apply highlighting to filtered nodes
          this.highlightFilteredNodes(newVal);
        } catch (error) {
          console.error("D3: Error in highlightedNodeIds watcher", error);
        }
      },
      deep: true
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

    // The updateNodeHighlighting method has been replaced by highlightFilteredNodes
  
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
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .on('click', () => {
              // Clear highlight when clicking on the background
              this.clearHighlight();
            });

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

        // Reset selection state
        this.selectedNodeId = null;
        this.nodeOriginalColors = {};

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

        // Debug: Check for nodes with public_ip=true
        const nodesWithPublicIp = visData.nodes.filter(node => 
          (node.data && node.data.public_ip === true) || 
          (node.properties && node.properties.public_ip === true));
        console.log('Nodes with public_ip=true:', nodesWithPublicIp.length);
        
        // Update simulation
        this.updateSimulation(visData);

        // Notify parent component about rendering completion
        setTimeout(() => {
          // Apply highlighting based on current highlighted nodes
          if (this.highlightedNodeIds && this.highlightedNodeIds.size > 0) {
            this.highlightFilteredNodes(this.highlightedNodeIds);
          }
          
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
          .on('click', (event, d) => {
            event.stopPropagation(); // Prevent click from reaching the SVG
            this.onNodeClick(d);
            this.highlightNode(d.id);
          });

      // Add network icon shapes using SVG
      const self = this;
      
      // Set nodeSize based on graph size - do this ONCE before the loop
      this.nodeSize = nodeCount > 100 ? 14 : 18;
      
      node.each(function(d) {
        const color = self.nodeColors[d.type] || '#ccc';
      
        // Store original color for later restoration
        self.nodeOriginalColors[d.id] = color;
      
        // Create group for the icon
        const iconGroup = d3.select(this).append('g')
            .attr('transform', `translate(${-self.nodeSize},${-self.nodeSize})`)
            .attr('width', self.nodeSize * 2)
            .attr('height', self.nodeSize * 2)
            .attr('class', 'node-icon-group');
      
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
            .attr('width', self.nodeSize * 2)
            .attr('height', self.nodeSize * 2)
            .attr('viewBox', svgElement.getAttribute('viewBox'))
            .style('color', color) // This works with the "currentColor" fill in the icons
            .html(svgContent);
            
        // Store the node size as a data attribute for later use
        d3.select(this).attr('data-node-size', self.nodeSize);
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

      // Add secondary cloud icon for nodes with public_ip = true
      console.log('Adding secondary icons to nodes');
      this.addSecondaryIcons(node);
      
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
     * Select and highlight a node by its ID
     * @param {string} nodeId ID of the node to select and highlight
     */
    selectAndHighlightNode(nodeId) {
      // Clear any existing highlight
      this.clearHighlight();

      // Find the node in the current nodes
      const node = this.currentNodes.find(n => n.id === nodeId);

      if (node) {
        console.log("D3: Selecting and highlighting node", node);

        // Emit the node clicked event
        this.onNodeClick(node);

        // Add a class to mark this as the selected node
        this.g.selectAll('.node')
            .classed('selected-node', d => d.id === nodeId);
    
        // Highlight the node and its connections
        this.highlightNode(nodeId);
    
        // Center view on the selected node with animation
        this.centerOnNode(node);
        
        // If we have filtered nodes, re-apply that highlighting
        if (this.highlightedNodeIds && this.highlightedNodeIds.size > 0) {
          // Re-apply filter highlighting but preserve selected node's connections
          this.highlightFilteredNodes(this.highlightedNodeIds);
        }
      } else {
        console.warn("D3: Node not found with ID", nodeId);
      }
    },

    /**
     * Center the view on a specific node
     * @param {Object} node The node to center on
     */
    centerOnNode(node) {
      if (!node || !node.x || !node.y) return;

      const container = this.$refs.d3Container;
      const width = container.clientWidth;
      const height = container.clientHeight;

      // Calculate the transform to center on this node
      const scale = this.currentZoomLevel;
      const x = width / 2 - node.x * scale;
      const y = height / 2 - node.y * scale;

      // Apply the transform with a smooth transition
      this.svg.transition().duration(500).call(
          this.zoom.transform,
          d3.zoomIdentity.translate(x, y).scale(scale)
      );
    },

    /**
     * Highlight a node and its connections
     * @param {string} nodeId ID of the node to highlight
     */
    highlightNode(nodeId) {
      // Clear any previous highlight
      this.clearHighlight();

      // Set the selected node
      this.selectedNodeId = nodeId;

      // Find all connected nodes
      const connectedNodes = new Set([nodeId]);
      const connectedLinks = [];

      this.currentLinks.forEach((link, index) => {
        if (link.source.id === nodeId) {
          connectedNodes.add(link.target.id);
          connectedLinks.push(index);
        } else if (link.target.id === nodeId) {
          connectedNodes.add(link.source.id);
          connectedLinks.push(index);
        }
      });

      // Apply highlight to nodes
      this.g.selectAll('.node')
          .filter(d => connectedNodes.has(d.id))
          .each(function(d) {
            const node = d3.select(this);
            // Store original transform for later restoration
            const currentTransform = node.attr('transform');
            node.attr('data-original-transform', currentTransform);

            // Scale up the node
            const translate = currentTransform.match(/translate\(([^)]+)\)/)[1].split(',');
            const x = parseFloat(translate[0]);
            const y = parseFloat(translate[1]);

            // Apply transform - bigger scale for selected node
            if (d.id === nodeId) {
              node.attr('transform', `translate(${x},${y}) scale(1.5)`)
                  .style('filter', 'drop-shadow(0 0 5px #4444ff)');
            } else {
              node.attr('transform', `translate(${x},${y}) scale(1.3)`)
                  .style('filter', 'drop-shadow(0 0 3px #4444ff)');
            }

            // Get the SVG icon element and change its color
            const svgIcon = node.select('svg');
            if (!svgIcon.empty()) {
              // Store original color
              const originalColor = svgIcon.style('color');
              node.attr('data-original-color', originalColor);

              // Apply purple color for connected nodes
              const highlightColor = d.id === nodeId ? '#7030A0' : '#9966CC';  // Dark purple for selected, lighter purple for connected
              svgIcon.style('color', highlightColor);
              
              // For Unknown nodes, also change the circle fill color and make question mark more visible
              if (d.type === 'Unknown' || d.data?.type === 'Unknown') {
                svgIcon.select('circle').attr('fill', highlightColor);
                // Make the question mark white and bolder for better visibility
                svgIcon.select('text').attr('fill', '#FFFFFF').attr('font-weight', 'bolder');
              }
            }
          })
          .select('text')
          .style('font-weight', 'bold')
          .style('font-size', function() {
            const currentSize = d3.select(this).style('font-size');
            const size = parseFloat(currentSize);
            const unit = currentSize.replace(/[\d.]/g, '');
            return `${size * 1.2}${unit}`;
          });

      // Make non-highlighted nodes semi-transparent
      this.g.selectAll('.node')
          .filter(d => !connectedNodes.has(d.id))
          .style('opacity', 0.3);

      // Highlight selected links
      this.g.selectAll('.link')
          .filter((d, i) => connectedLinks.includes(i))
          .attr('stroke-width', 3)
          .attr('stroke', '#4444ff');

      // Make non-highlighted links transparent and dotted
      this.g.selectAll('.link')
          .filter((d, i) => !connectedLinks.includes(i))
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '3,3')
          .attr('stroke-opacity', 0.2);
    },
    
    /**
     * Highlight multiple nodes based on filter criteria
     * @param {Set} nodeIds Set of node IDs to highlight
     */
    highlightFilteredNodes(nodeIds) {
      // If there are no nodes to highlight, do nothing
      if (!nodeIds || nodeIds.size === 0) {
        this.clearHighlight();
        return;
      }
      
      // Don't clear previous highlight if we have a selected node
      if (!this.selectedNodeId) {
        this.clearHighlight();
      }
      
      console.log(`D3: Highlighting ${nodeIds.size} filtered nodes`);
      
      // Apply highlight to nodes that match filter
      this.g.selectAll('.node')
          .filter(d => nodeIds.has(d.id))
          .each(function(d) {
            const node = d3.select(this);
            
            // Don't modify if this is already the selected node
            if (node.classed('selected-node')) {
              return;
            }
            
            // Store original color if not already stored
            if (!node.attr('data-original-color')) {
              const svgIcon = node.select('svg');
              if (!svgIcon.empty()) {
                const originalColor = svgIcon.style('color');
                node.attr('data-original-color', originalColor);
              }
            }
            
            // Get the SVG icon element and change its color to purple
            const svgIcon = node.select('svg');
            if (!svgIcon.empty()) {
              svgIcon.style('color', '#9966CC'); // Light purple for filtered nodes
              
              // For Unknown nodes, also change the circle fill color and make question mark more visible
              if (d.type === 'Unknown' || d.data?.type === 'Unknown') {
                svgIcon.select('circle').attr('fill', '#9966CC');
                // Make the question mark white and bolder for better visibility
                svgIcon.select('text').attr('fill', '#FFFFFF').attr('font-weight', 'bolder');
              }
            }
            
            // Add drop shadow
            node.style('filter', 'drop-shadow(0 0 3px #4444ff)');
          });
      
      // Make non-filtered nodes semi-transparent
      this.g.selectAll('.node')
          .filter(d => !nodeIds.has(d.id) && d.id !== this.selectedNodeId)
          .style('opacity', 0.3);
      
      // If we have a selected node, keep its connections highlighted
      if (this.selectedNodeId) {
        return;
      }
          
      // Make all links semi-transparent for better focus on filtered nodes
      this.g.selectAll('.link')
          .attr('stroke-opacity', 0.2);
    },

    /**
     * Add cloud icon annotation for nodes with public_ip = true
     */
    addSecondaryIcons(nodeSelection) {
      const self = this;
      
      // Add cloud icons only to nodes with public_ip = true
      nodeSelection.each(function(d) {
        // Get the node size from the data attribute or use the global value
        const nodeSize = d3.select(this).attr('data-node-size') || self.nodeSize;
        
        // Check all possible paths for public_ip
        const hasPublicIp = 
          (d.data && d.data.public_ip === true) || 
          (d.properties && d.properties.public_ip === true) ||
          (d.public_ip === true) ||
          (d.data && d.data.properties && d.data.properties.public_ip === true);
        
        if (hasPublicIp) {
          console.log('Adding public IP indicator to node:', d.id);
          
          // Size of the cloud icon relative to the node - make it about 0.9x the node size
          const iconSize = nodeSize * 0.9;
          
          // Position in the upper right corner with 50% overlap
          const iconX = nodeSize / 2;   // 50% to the right of center  
          const iconY = -nodeSize / 2;  // 50% above center
          
          // Create a group for the cloud icon to ensure proper positioning
          const indicatorGroup = d3.select(this).append('g')
            .attr('class', 'public-ip-indicator-group')
            .attr('transform', `translate(${iconX}, ${iconY})`) // Position in the upper right quadrant
            .attr('pointer-events', 'none'); // Ensure it doesn't interfere with interactions
          
          // Get the Public IP icon from networkIcons
          const cloudIconSvg = networkIcons.PublicIP;
          
          // Create a temporary div to hold the SVG content
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = cloudIconSvg;
          
          // Extract the SVG element and its content
          const svgElement = tempDiv.querySelector('svg');
          const svgContent = svgElement.innerHTML;
          const originalViewBox = svgElement.getAttribute('viewBox') || '0 0 24 24';
          
          // Create a new SVG element for the cloud icon
          // We need to center the icon on the translate point
          const cloudIcon = indicatorGroup.append('svg')
            .attr('width', iconSize)
            .attr('height', iconSize * 0.75) // Maintain original aspect ratio (0.75)
            .attr('viewBox', originalViewBox)
            .attr('x', -iconSize / 2)  // Center horizontally on the translate point
            .attr('y', -iconSize * 0.75 / 2) // Center vertically on the translate point
            .html(svgContent);
            
          // Add a tooltip to show "Public IP" on hover
          indicatorGroup.append('title')
            .text('Public IP');
        }
      });
    },
    
    /**
     * Clear any highlighting
     */
    clearHighlight() {
      // Restore original node appearance
      this.g.selectAll('.node')
          .each(function() {
            const node = d3.select(this);
    
            // Restore original transform
            const originalTransform = node.attr('data-original-transform');
            if (originalTransform) {
              node.attr('transform', originalTransform);
            }
    
            // Remove drop shadow
            node.style('filter', null);
    
            // Restore original color
            const originalColor = node.attr('data-original-color');
            if (originalColor) {
              const svgIcon = node.select('svg');
              svgIcon.style('color', originalColor);
              
              // Reset circle fill color and text styling for Unknown nodes
              const d = d3.select(this).datum();
              if (d.type === 'Unknown' || d.data?.type === 'Unknown') {
                svgIcon.select('circle').attr('fill', '#F9C96E'); // Restore to original orange
                // Restore question mark to original color and weight
                svgIcon.select('text').attr('fill', '#666666').attr('font-weight', 'bold');
              }
            }
          })
          .style('opacity', 1) // Restore opacity
          .classed('selected-node', false) // Remove selected class
          .select('text')
          .style('font-weight', 'normal')
          .style('font-size', null);
    
      // Restore original link appearance
      this.g.selectAll('.link')
          .attr('stroke-width', 1.5)
          .attr('stroke', '#999')
          .attr('stroke-dasharray', null) // Remove dotted style
          .attr('stroke-opacity', 1); // Restore opacity
    
      // Clear selected node
      this.selectedNodeId = null;
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
      
      // Debug: Log information about nodes with public_ip
      this.debugNodeData();
    },
    
    /**
     * Debug helper to inspect node data structure
     */
    debugNodeData() {
      console.log('Total nodes:', this.currentNodes.length);
      
      // Check for public_ip in various possible locations in node data
      const publicIpNodes = this.currentNodes.filter(node => {
        const hasPublicIp = 
          (node.data && node.data.public_ip === true) || 
          (node.properties && node.properties.public_ip === true) ||
          (node.public_ip === true) ||
          (node.data && node.data.properties && node.data.properties.public_ip === true);
        return hasPublicIp;
      });
      
      console.log('Nodes with public_ip:', publicIpNodes.length);
      
      if (publicIpNodes.length > 0) {
        // Print a more complete dump of the first node
        const sampleNode = publicIpNodes[0];
        console.log('Sample node with public_ip:', sampleNode);
        console.log('Node properties:', JSON.stringify(sampleNode.properties || {}));
        console.log('Node data:', JSON.stringify(sampleNode.data || {}));
        
        // Check where the public_ip property is actually located
        if (sampleNode.data && sampleNode.data.public_ip === true) {
          console.log('Found public_ip at: node.data.public_ip');
        }
        if (sampleNode.properties && sampleNode.properties.public_ip === true) {
          console.log('Found public_ip at: node.properties.public_ip');
        }
        if (sampleNode.public_ip === true) {
          console.log('Found public_ip at: node.public_ip');
        }
        if (sampleNode.data && sampleNode.data.properties && sampleNode.data.properties.public_ip === true) {
          console.log('Found public_ip at: node.data.properties.public_ip');
        }
      }
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
  transition: all 0.3s ease;
}

:deep(.node) {
  cursor: pointer;
  transition: all 0.3s ease;
}

:deep(.node-icon-group) {
  /* Ensure icon rendering is consistent */
  pointer-events: all;
}

:deep(.public-ip-indicator-group) {
  pointer-events: none;
  opacity: 0.9;
}

:deep(.node-label) {
  font-family: sans-serif;
  pointer-events: none;
  transition: all 0.3s ease;
}

:deep(.public-ip-annotation) {
  pointer-events: none;
  transition: all 0.3s ease;
}

:deep(.public-ip-annotation-inner) {
  pointer-events: none;
}
</style>