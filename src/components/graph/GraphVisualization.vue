<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

// src/components/graph/GraphVisualization.vue
<template>
  <div id="d3-container" ref="d3Container"></div>
</template>

<script>
import * as d3 from 'd3';
import networkIcons from '../networkIcons';
import { transformNeo4JDataForD3, getNodeLabel } from './graphTransformUtils';

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

      // Track selected node IDs (multi-selection mode)
      selectedNodeIds: new Set(),

      // Track the most recently selected node ID
      lastSelectedNodeId: null,
  
      // Store node colors for restoration
      nodeOriginalColors: {},
      
      // Node size for rendering
      nodeSize: 18,
      
      // Larger node size for selected nodes
      selectedNodeSize: 24
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
    transformNeo4JDataForD3,
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
            .on('click', (event) => {
              // Only clear highlight when not pressing shift key
              if (!event.shiftKey) {
                this.clearHighlight();
                // Make sure we reset the selectedNodeIds
                this.selectedNodeIds.clear();
              }
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
        this.selectedNodeIds.clear();
        this.nodeOriginalColors = {};

        let visData;

        // No need to transform based on view mode - data is already transformed in App.vue
        visData = this.transformNeo4JDataForD3(this.graphData);

        // Store node positions before updating
        this.saveNodePositions();

        // Apply any saved positions to the new nodes
        this.applyNodePositions(visData.nodes);

        // Store current nodes and links
        this.currentNodes = visData.nodes;
        this.currentLinks = visData.links;

        // Debug: Check for nodes with public_ip=true
        const nodesWithPublicIp = visData.nodes.filter(node => 
          node.data && node.data.public_ip === true);
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
      
      // Force update to apply styles and bring selected elements to front
      this.tick();
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
            this.onNodeClick(d, event);
            this.highlightNode(d.id, event.shiftKey);
          });

      // Add network icon shapes using SVG
      const self = this;
      
      // Set nodeSize based on graph size - do this ONCE before the loop
      this.nodeSize = nodeCount > 100 ? 14 : 18;
      
      node.each(function(d) {
        const color = self.nodeColors[d.type] || '#ccc';
      
        // Store original color for later restoration
        self.nodeOriginalColors[d.id] = color;
      
        // Check if this is a virtual application node
        const isVirtual = d.type === 'Application' && d.data.virtual === true;
        
        // Draw dashed circle for virtual application nodes
        if (isVirtual) {
          d3.select(this).append('circle')
            .attr('r', self.nodeSize * 1.3)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-dasharray', '3,3')
            .attr('class', 'virtual-node-circle');
        }
      
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
            .style('opacity', isVirtual ? 0.50 : 1) // 25% transparent for virtual nodes
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
          
      // Update label positions
      this.updateEdgeLabelPositions();
      this.updateNodeDetailPositions();
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
            
            // Update node label position immediately during drag
            this.g.selectAll('.node-label')
                .filter(labelData => labelData.id === d.id)
                .attr('x', d.x)
                .attr('y', d.y + this.nodeSize + 14);
            
            // Update any node detail labels for this node immediately during drag
            this.g.selectAll('.node-detail-label')
                .filter(labelData => labelData.id === d.id)
                .attr('transform', `translate(${d.x + 20}, ${d.y})`);
          })
          .on('end', (event, d) => {
            if (!event.active) this.simulation.alphaTarget(0);
            // Keep fx and fy set to maintain the node's position
            // We no longer set d.fx = null; d.fy = null;
          });
      
      // Make the selected node's detail label larger and bring it to front
      this.enhanceSelectedNodeDetail(nodeId);
      
      // Force a tick to update all positions and z-ordering
      if (this.simulation) {
        this.tick();
      }
    },
    
    /**
     * Enhance the selected node's detail label and icon
     * Makes them larger and brings them to front
     * @param {string} selectedNodeId The ID of the selected node
     */
    enhanceSelectedNodeDetail(selectedNodeId) {
      // Find the node detail label for the selected node
      const detailLabels = this.g.selectAll('.node-detail-label');
      
      // Reset all detail labels first
      detailLabels
        .style('font-size', null)
        .style('font-weight', null);
      
      // Select all node icons and reset them
      this.g.selectAll('.node-icon')
        .attr('width', 20)
        .attr('height', 20)
        .attr('x', d => d.x - 10)
        .attr('y', d => d.y - 10);
      
      // Find the selected node's detail label and enhance it
      detailLabels.each(function(d) {
        if (d && d.id === selectedNodeId) {
          // Get the label element
          const label = d3.select(this);
          
          // Make it larger and bold
          label.style('font-size', '14px')
               .style('font-weight', 'bold');
               
          // Bring to front using D3's raise method
          label.raise();
        }
      });
      
      // Find the selected node's icon and make it larger
      this.g.selectAll('.node-icon').each(function(d) {
        if (d && d.id === selectedNodeId) {
          const icon = d3.select(this);
          
          // Make icon larger
          icon.attr('width', 24)
              .attr('height', 24)
              .attr('x', d.x - 12)
              .attr('y', d.y - 12);
              
          // Bring to front
          icon.raise();
        }
      });
      
      // Also bring the node circle itself to front
      this.g.selectAll('.node').each(function(d) {
        if (d && d.id === selectedNodeId) {
          // Make node slightly larger
          const node = d3.select(this);
          node.attr('r', 22); // Larger radius than default
          
          // Bring to front
          node.raise();
        }
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
          
      // Node detail labels will be updated automatically in the next tick
      // via updateNodeDetailPositions, so no manual update needed here
    },

    /**
     * Handle node click event
     * @param {Object} node The clicked node data
     * @param {Object} event The original DOM event
     */
    onNodeClick(node, event) {
      // Emit node clicked event with the node data and shift key state
      this.$emit('node-clicked', node.data, event);
    },

    /**
     * Select and highlight a node by its ID
     * @param {string} nodeId ID of the node to select and highlight
     * @param {boolean} appendToSelection Whether to add to existing selection
     */
    selectAndHighlightNode(nodeId, appendToSelection = false) {
      // Only clear existing highlight if not appending
      if (!appendToSelection) {
        this.clearHighlight();
      }
    
      // Find the node in the current nodes
      const node = this.currentNodes.find(n => n.id === nodeId);
    
      if (node) {
        console.log("D3: Selecting and highlighting node", node);
    
        // Emit the node clicked event (without causing recursive loop)
        // Don't call onNodeClick as it would trigger another highlight
        
        // Add a class to mark this as a selected node
        this.g.selectAll('.node')
            .classed('selected-node', d => d.id === nodeId || 
              (appendToSelection && this.selectedNodeIds.has(d.id)));
    
        // Highlight the node and its connections
        this.highlightNode(nodeId, appendToSelection);
    
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
          
      // Remove any node detail labels
      this.g.selectAll('.node-detail-label').remove();
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
     * @param {boolean} appendToSelection Whether to add to existing selection
     */
    highlightNode(nodeId, appendToSelection = false) {
      console.log("D3: Highlighting node", nodeId, "append =", appendToSelection);
      
      // Store all connected nodes and links across all selections
      let allConnectedNodes = new Set();
      let allConnectedLinks = [];
      
      // Only clear existing highlight if not appending
      if (!appendToSelection) {
        this.clearHighlight();
        this.selectedNodeIds.clear(); // Clear the set when not appending
      } else {
        // If appending, start with current highlighted connections
        this.selectedNodeIds.forEach(id => {
          // Find connections for each selected node
          const connections = this.getConnectedNodes(id);
          connections.nodes.forEach(nodeId => allConnectedNodes.add(nodeId));
          allConnectedLinks.push(...connections.links);
        });
      }
      
      // Add the new node to the selection
      this.selectedNodeIds.add(nodeId);
      
      // Get connected nodes and links for the current selection
      const { nodes: connectedNodes, links: connectedLinks } = this.getConnectedNodes(nodeId);
      
      // Add to our complete set of connected elements
      connectedNodes.forEach(id => allConnectedNodes.add(id));
      allConnectedLinks.push(...connectedLinks);
      
      console.log("D3: Total selected nodes:", this.selectedNodeIds.size, 
                 "Connected nodes:", allConnectedNodes.size,
                 "Connected links:", allConnectedLinks.length);
      
      // Apply highlight to all connected nodes
      this.g.selectAll('.node')
          .filter(d => connectedNodes.has(d.id))
          .each(function(d) {
            const node = d3.select(this);
            
            // Skip if this node is already transformed (for multi-select)
            if (appendToSelection && node.attr('data-original-transform')) {
              return;
            }
            
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
              // Store original color if not already stored
              if (!node.attr('data-original-color')) {
                const originalColor = svgIcon.style('color');
                node.attr('data-original-color', originalColor);
              }
    
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
            const textEl = d3.select(this);
            // Check if we've already stored the original font size
            if (!textEl.attr('data-original-font-size')) {
              const currentSize = textEl.style('font-size');
              textEl.attr('data-original-font-size', currentSize);
            }
            // Use the stored original size to calculate the enhanced size
            const originalSize = textEl.attr('data-original-font-size');
            const size = parseFloat(originalSize);
            const unit = originalSize.replace(/[\d.]/g, '');
            return `${size * 1.2}${unit}`; // Apply 1.2x sizing once
          });
      
      // Update opacity for all nodes - keep all connected nodes fully opaque
      this.updateNodesOpacity(allConnectedNodes);
    
      // Highlight all connected links
      this.g.selectAll('.link')
          .filter((d, i) => connectedLinks.includes(i))
          .attr('stroke-width', 3)
          .attr('stroke', '#4444ff');
    
      // Update link styling for all links
      this.updateLinksVisibility(allConnectedLinks);
      
      // Show node labels for all selected nodes
      this.showSelectedNodeLabels();
      
      // Show labels for edges (only outgoing connections)
      this.showEdgeLabels();
      
      // Show labels for edges (only outgoing connections)
      this.showEdgeLabels();
    },
    
    /**
     * Show simplified labels for all selected nodes and their connected nodes
     * Displays just address and app name
     */
    showSelectedNodeLabels() {
      // Remove any existing node detail labels first
      this.g.selectAll('.node-detail-label').remove();
      
      if (this.selectedNodeIds.size === 0) return;
      
      // Create a set of all node IDs to show labels for
      const nodesToLabelSet = new Set();
      
      // Add all selected nodes to the set
      this.selectedNodeIds.forEach(nodeId => {
        nodesToLabelSet.add(nodeId);
        
        // Also add connected nodes to the set
        const { nodes: connectedNodes } = this.getConnectedNodes(nodeId);
        connectedNodes.forEach(connectedId => {
          nodesToLabelSet.add(connectedId);
        });
      });
      
      console.log("D3: Showing simplified labels for", nodesToLabelSet.size, "nodes (selected and connected)");
      
      // Find all nodes that are in our nodesToLabel set
      this.g.selectAll('.node')
          .filter(d => nodesToLabelSet.has(d.id))
          .each((d) => {
            const nodeData = d.data || d;
            
            // Extract just the essential information we want to display
            const appName = nodeData.app_name || '';
            const address = nodeData.address || '';
            
            // Skip if we don't have anything to show
            if (!appName && !address) return;
            
            // Create an array of lines to display
            const labelLines = [];
            
            // App name is always shown first if available
            if (appName) {
              labelLines.push(appName);
            }
            
            // Add address if available
            if (address) {
              labelLines.push(address);
            }
            
            // Skip if no lines to show
            if (labelLines.length === 0) return;
            
            // Calculate label position (to the right of the node)
            const labelX = d.x + 20;
            const labelY = d.y;
            
            // Create a group for the label and bind the node data to it
            const labelGroup = this.g.append('g')
                .datum(d) // Bind the node data to the label for updates in tick
                .attr('class', 'node-detail-label')
                .attr('data-node-id', d.id)
                .attr('transform', `translate(${labelX}, ${labelY})`);
            
            // Determine styling based on whether node is directly selected or just connected
            const isSelected = this.selectedNodeIds.has(d.id);
            const textColor = isSelected ? '#333' : '#666'; // Darker for selected, lighter for connected
            const fontWeight = isSelected ? 'bold' : 'normal'; // Bold for selected
            
            // Add each line of text
            labelLines.forEach((line, i) => {
              labelGroup.append('text')
                  .attr('x', 0)
                  .attr('y', i * 14) // Smaller line height
                  .attr('fill', textColor)
                  .attr('font-size', '11px')
                  .attr('font-weight', fontWeight)
                  .text(line)
                  .style('text-shadow', '0 0 3px white, 0 0 3px white, 0 0 3px white, 0 0 3px white'); // Add white glow for readability
            });
          });
    },
    
    /**
     * Get the connected nodes and links for a given node ID
     * @param {string} nodeId ID of the node
     * @returns {Object} Object with sets of connected nodes and links
     */
    getConnectedNodes(nodeId) {
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
      
      return { nodes: connectedNodes, links: connectedLinks };
    },
    
    /**
     * Update all nodes opacity based on connected nodes
     * @param {Set} connectedNodes Set of connected node IDs that should be fully opaque
     */
    updateNodesOpacity(connectedNodes) {
      // Reset all nodes to semi-transparent first
      this.g.selectAll('.node')
          .style('opacity', 0.3);
          
      // Then make connected nodes fully opaque
      this.g.selectAll('.node')
          .filter(d => connectedNodes.has(d.id))
          .style('opacity', 1);
    },
    
    /**
     * Update all links visibility based on connected links
     * @param {Array} connectedLinks Array of connected link indices that should be highlighted
     */
    updateLinksVisibility(connectedLinks) {
      // Reset all links to faded first
      this.g.selectAll('.link')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '3,3')
          .attr('stroke-opacity', 0.2);
          
      // Then highlight connected links
      this.g.selectAll('.link')
          .filter((d, i) => connectedLinks.includes(i))
          .attr('stroke-width', 3)
          .attr('stroke', '#4444ff')
          .attr('stroke-dasharray', null)
          .attr('stroke-opacity', 1);
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
      
      // Don't clear previous highlight if we have selected nodes
      if (this.selectedNodeIds.size === 0) {
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
          .filter(d => !nodeIds.has(d.id) && !this.selectedNodeIds.has(d.id))
          .style('opacity', 0.3);
      
      // If we have selected nodes, keep their connections highlighted
      if (this.selectedNodeIds.size > 0) {
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
        const hasPublicIp = d.data && d.data.public_ip === true;
        
        if (hasPublicIp) {
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
      // Log for debugging
      console.log("D3: Clearing all highlights");
      
      // Restore original node appearance
      this.g.selectAll('.node')
          .each(function() {
            const node = d3.select(this);
    
            // Restore original transform
            const originalTransform = node.attr('data-original-transform');
            if (originalTransform) {
              node.attr('transform', originalTransform);
              // Clear the stored transform data
              node.attr('data-original-transform', null);
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
              
              // Clear the stored color data
              node.attr('data-original-color', null);
            }
          })
          .style('opacity', 1) // Restore opacity
          .classed('selected-node', false) // Remove selected class
          .select('text')
          .each(function() {
            const textEl = d3.select(this);
            // Restore original font size if stored
            const originalSize = textEl.attr('data-original-font-size');
            if (originalSize) {
              textEl.style('font-size', originalSize);
              // Clear the stored original size
              textEl.attr('data-original-font-size', null);
            } else {
              textEl.style('font-size', null);
            }
            textEl.style('font-weight', 'normal');
          });
    
      // Restore original link appearance
      this.g.selectAll('.link')
          .attr('stroke-width', 1.5)
          .attr('stroke', '#999')
          .attr('stroke-dasharray', null) // Remove dotted style
          .attr('stroke-opacity', 1); // Restore opacity

      // Remove all node and edge labels
      // Remove all node and edge labels
      this.g.selectAll('.node-detail-label').remove();
      this.g.selectAll('.edge-label').remove();
      
      this.g.selectAll('.edge-label').remove();
      
      // Clear the set of selected nodes
      this.selectedNodeIds.clear();
    },

    /**
     * Update the position of edge labels when nodes move
     * This is called during simulation ticks
     */
    updateEdgeLabelPositions() {
      if (this.selectedNodeIds.size === 0) return;
      
      // Update all edge label groups
      this.g.selectAll('g.edge-label').each((d, i, nodes) => {
        const labelGroup = d3.select(nodes[i]);
        const linkIndex = parseInt(labelGroup.attr('data-link-index'));
        const direction = labelGroup.attr('data-direction');
        
        if (!isNaN(linkIndex) && this.currentLinks[linkIndex]) {
          const link = this.currentLinks[linkIndex];
          const sourceNode = link.source;
          const targetNode = link.target;
          
          if (sourceNode && targetNode) {
            // Different positions based on whether it's outgoing or incoming
            const positionRatio = (direction === 'outgoing') ? 0.4 : 0.6;
            
            // Calculate new position
            const posX = sourceNode.x + (targetNode.x - sourceNode.x) * positionRatio;
            const posY = sourceNode.y + (targetNode.y - sourceNode.y) * positionRatio;
            
            // Update group position
            labelGroup.attr('transform', `translate(${posX},${posY})`);
          }
        }
      });
    },
    
    /**
     * Show labels for edges of selected nodes (both outgoing and incoming connections)
     */
    showEdgeLabels() {
      // Remove any existing edge labels
      this.g.selectAll('.edge-label').remove();
    
      // For each selected node, show labels for its connections
      this.selectedNodeIds.forEach(nodeId => {
        // Get all connected links
        const { links: connectedLinkIndices } = this.getConnectedNodes(nodeId);
        
        // Process each connected link
        connectedLinkIndices.forEach(linkIndex => {
          const link = this.currentLinks[linkIndex];
          if (!link) return;
          
          // Get the source and target nodes
          const sourceNode = link.source;
          const targetNode = link.target;
          
          // Determine if this is an outgoing or incoming connection
          const isOutgoing = sourceNode.id === nodeId;
          
          // The relationship type will be our label with directional indicator
          const labelText = link.type || 'CONNECTED_TO';
          
          // Position the label differently based on direction
          // For outgoing: 40% of the way from source to target
          // For incoming: 60% of the way from source to target (closer to target)
          const positionRatio = isOutgoing ? 0.4 : 0.6;
          const posX = sourceNode.x + (targetNode.x - sourceNode.x) * positionRatio;
          const posY = sourceNode.y + (targetNode.y - sourceNode.y) * positionRatio;
          
          // Calculate label width based on text length
          const labelWidth = labelText.length * 5 + 10;
          
          // Create a group for the label
          const labelGroup = this.g.append('g')
            .attr('class', 'edge-label')
            .attr('data-link-index', linkIndex)
            .attr('data-direction', isOutgoing ? 'outgoing' : 'incoming')
            .attr('transform', `translate(${posX},${posY})`);
          
          // Add a background rectangle for better visibility
          labelGroup.append('rect')
            .attr('x', -labelWidth/2)
            .attr('y', -9)
            .attr('width', labelWidth)
            .attr('height', 18)
            .attr('rx', 3) // Rounded corners
            .attr('ry', 3)
            .attr('fill', 'white')
            .attr('opacity', 0.85);
          
          // Add the text label
          labelGroup.append('text')
            .attr('x', 0)
            .attr('y', 2)
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .attr('fill', '#9966CC') // Light purple like connected nodes
            .attr('font-size', '10px')
            .attr('font-weight', 'bold')
            .text(labelText);
        });
      });
    },
    
    // This duplicate method is removed, as we already have updateEdgeLabelPositions defined above
    
    /**
     * Update the position of node detail labels when nodes move
     * This is called during simulation ticks
     */
    updateNodeDetailPositions() {
      const self = this;
      // Update all node detail label positions
      this.g.selectAll('.node-detail-label').each(function(d) {
        if (d && d.x !== undefined && d.y !== undefined) {
          // Position to the right of the node
          const labelX = d.x + 20;
          const labelY = d.y;
          
          // Check if this is the selected node
          const isSelected = self.selectedNodeIds.has(d.id);
          
          // Get the label element
          const label = d3.select(this);
          
          // Update the label position
          label.attr('transform', `translate(${labelX}, ${labelY})`);
          
          // Make selected node label visibly larger
          if (isSelected) {
            // Find the text element within this label group
            const textElement = label.select('text');
            textElement.style('font-size', '16px')
                      .style('font-weight', 'bold')
                      .style('stroke-width', '3px'); // Thicker outline for better readability
            
            // Bring the label to the front
            label.raise();
            
            // Also make the corresponding node circle larger and bring it to front
            self.g.selectAll('.node').each(function(nodeData) {
              if (nodeData.id === d.id) {
                const nodeElement = d3.select(this);
                // Make the node 50% larger than normal
                nodeElement.attr('r', self.nodeSize * 1.5);
                // Bring to front
                nodeElement.raise();
              }
            });
            
            // Also make the node icon larger and bring to front
            self.g.selectAll('.node-icon').each(function(nodeData) {
              if (nodeData.id === d.id) {
                const iconElement = d3.select(this);
                // Make the icon larger
                iconElement.attr('width', 30)
                          .attr('height', 30)
                          .attr('x', nodeData.x - 15)
                          .attr('y', nodeData.y - 15);
                // Bring to front
                iconElement.raise();
              }
            });
          } else {
            // Reset to normal style for non-selected nodes
            const textElement = label.select('text');
            textElement.style('font-size', '12px')
                      .style('font-weight', 'normal')
                      .style('stroke-width', '2px');
          }
          
          // Make selected node label more prominent
          if (isSelected) {
            // Make label larger and bold
            label.classed('selected-node-label', true)
                 .style('font-size', '14px')
                 .style('font-weight', 'bold');
                 
            // Bring the selected label to the front
            label.raise();
          } else {
            // Reset to normal style
            label.classed('selected-node-label', false)
                 .style('font-size', null)
                 .style('font-weight', null);
          }
        }
      });
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

            // Apply sizes based on selection state
            this.updateNodeSizes();
            
      this.$emit('zoom-change', this.currentZoomLevel);
      
      // Debug: Log information about nodes with public_ip
      this.debugNodeData();
        
      // Update node label positions
      this.g.selectAll('.node-label')
        .attr('x', d => d.x)
        .attr('y', d => d.y + this.nodeSize + 12);
          
      // Reset last selected node ID
      this.lastSelectedNodeId = null;
      
      // Reset node sizes
      this.updateNodeSizes();
    },
    
    /**
     * Update node sizes based on selection state
     * Makes selected nodes larger and brings them to front
     */
    updateNodeSizes() {
      this.g.selectAll('.node').each((d) => {
        const isSelected = this.selectedNodeIds.has(d.id);
        const nodeElement = d3.select(`#node-${d.id}`);
        
        // Set node size
        const nodeSize = isSelected ? this.selectedNodeSize : this.nodeSize;
        nodeElement.attr('r', nodeSize);
        
        // Bring selected nodes to front
        if (isSelected && d.id === this.lastSelectedNodeId) {
          nodeElement.raise();
        }
      });
    },
    
    /**
     * Debug helper to inspect node data structure
     */
    debugNodeData() {
      console.log('Total nodes:', this.currentNodes.length);
      
      // Check for public_ip only in node.data
      const publicIpNodes = this.currentNodes.filter(node => 
        node.data && node.data.public_ip === true
      );
      
      console.log('Nodes with public_ip:', publicIpNodes.length);
      
      if (publicIpNodes.length > 0) {
        // Print a more complete dump of the first node
        const sampleNode = publicIpNodes[0];
        console.log('Sample node with public_ip:', sampleNode);
        console.log('Node data:', JSON.stringify(sampleNode.data || {}));
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
  
  /* Node detail labels (applied through D3) */
  :deep(.node-detail-label) {
  pointer-events: none; /* Prevent interfering with clicks */
  z-index: 10;
  }
  
  :deep(.node-detail-label text) {
    font-family: 'Inter', 'Avenir', Helvetica, Arial, sans-serif;
  pointer-events: none;
  user-select: none;
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