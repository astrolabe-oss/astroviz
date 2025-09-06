<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div id="g6-container" class="g6-widget"></div>
</template>

<script>
import {ExtensionCategory, Graph, register} from '@antv/g6';
import { ConcentricLayout, RadialLayout, ForceLayout, D3ForceLayout, FruchtermanLayout, ForceAtlas2Layout, CircularLayout, RandomLayout } from '@antv/layout';
import { SimpleBottomUpLayout } from '@/layouts/SimpleBottomUpLayout.js';
import {TightCircleCombo} from "@/elements/TightCircleCombo";

// Register our custom combo as the default circle combo
register(ExtensionCategory.COMBO, 'circle', TightCircleCombo);

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
      graph: null
    };
  },

  mounted() {
    console.log('GraphVisualization mounted, waiting for DOM...');
    this.$nextTick(() => {
      console.log('DOM ready, initializing G6');
      this.initializeG6();
    });
  },

  beforeDestroy() {
    if (this.graph) {
      console.log('Destroying G6 instance');
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
    }
  },

  methods: {
    initializeG6() {
      console.log('Initializing G6 with container');

      const container = document.getElementById('g6-container');
      if (!container) {
        console.error('Container element #g6-container not found!');
        return;
      }

      // Get container dimensions
      const { width, height } = container.getBoundingClientRect();
      console.log('Container dimensions:', width, 'x', height);

      // Initial empty data
      const emptyData = {
        nodes: [],
        edges: [],
        combos: []
      };

      // Create G6 graph instance using the correct v5 API
      this.graph = new Graph({
        container: 'g6-container',
        width: width || 800,
        height: height || 600,
        data: emptyData,
        animation: false,  // Disable animations to avoid rendering issues
        // layout: {
        //   // COMBO-COMBINED: Better spacing layouts
        //   type: 'combo-combined',
        //   comboPadding: 80,  // Increased padding
        //   innerLayout: new RandomLayout({
        //     // Simple random for inner nodes
        //   }),
        //   outerLayout: new CircularLayout({
        //     radius: 300,
        //     startAngle: 0,
        //     endAngle: 2 * Math.PI,
        //     divisions: 1,
        //     ordering: 'topology'
        //   })
        // },
        // OPTION 2: Concentric layout for better spacing
        // layout: {
        //   type: 'combo-combined',
        //   comboPadding: 100,
        //   innerLayout: new RandomLayout({}),
        //   outerLayout: new ConcentricLayout({
        //     sortBy: 'degree',
        //     nodeSize: 80,
        //     clockwise: true,
        //     preventOverlap: true,
        //     minNodeSpacing: 120,
        //     radius: 250,
        //     startRadius: 150
        //   })
        // },
        //
        // OPTION 3: Force layout for combo spacing
        // layout: {
        //   type: 'combo-combined',
        //   comboPadding: 60,
        //   innerLayout: new CircularLayout({ radius: 40 }),
        //   outerLayout: new ForceLayout({
        //     preventOverlap: true,
        //     nodeSize: 120,
        //     linkDistance: 250,
        //     nodeStrength: -400,
        //     edgeStrength: 0.1
        //   })
        // },
        layout: {
          type: 'simple-bottom-up',
          spacing: 0,
          comboPadding: 0
        },
        // layout: {
        //   preventOverlap: true,
        //   type: 'custom-combo-combined',
        //   spacing: 50,  // Increased spacing between all nodes
        //   comboPadding: 20,  // Increased padding inside combos
        // }
          // Force layout for outer (combos and public nodes)
          // outerLayout: new ForceLayout({
          //   preventOverlap: true,
          //   // preventNodeOverlap: true,
          //   // nodeStrength: 300,
          //   // edgeStrength: 0.2,
          //   // iterations: 300,
          //   // center: [window.innerWidth / 2, window.innerHeight / 2]
          // }),
          // // Concentric layout for inner (nodes within combos)
          // innerLayout: new RadialLayout({
          //   nodeSize: 30,
          //   minNodeSpacing: 10,
          //   preventOverlap: true,
          //   sortBy: 'degree'
          // })
        // },
        // layout: {
        //   // COMBO-COMBINED: Concentric outside, D3Force inside
        //   type: 'combo-combined',
        //   comboPadding: 60,
        //   nodeSpacing: (d) => 8,
        //   preventOverlap: true,
        //   innerLayout: new RandomLayout({
        //     comboPadding: 60,
        //     nodeSpacing: (d) => 8,
        //     preventOverlap: true,
        //     nodeSize: 20,
        //     // linkDistance: 50,
        //     // nodeStrength: -200,
        //     // edgeStrength: 0.3,
        //     // center: [0, 0]
        //   }),
        //   outerLayout: new RandomLayout({
        //     sortBy: 'degree',
        //     nodeSize: 30,
        //     comboPadding: 60,
        //     nodeSpacing: (d) => 10,
        //     preventOverlap: true,
        //     minNodeSpacing: 40,
        //     // radius: 200,
        //     // startRadius: 150
        //   })
        // },
        // layout: {
        //   // COMBO-COMBINED: Concentric outside, D3Force inside
        //   type: 'combo-combined',
        //   comboPadding: 60,
        //   innerLayout: new D3ForceLayout({
        //     preventOverlap: true,
        //     nodeSize: 20,
        //     linkDistance: 50,
        //     nodeStrength: -200,
        //     edgeStrength: 0.3,
        //     center: [0, 0]
        //   }),
        //   outerLayout: new ConcentricLayout({
        //     sortBy: 'degree',
        //     nodeSize: 30,
        //     clockwise: true,
        //     preventOverlap: true,
        //     minNodeSpacing: 40,
        //     radius: 200,
        //     startRadius: 150
        //   })
        // },
        // layout: {
        //   // COMBO LAYOUTS (commented out for testing)
        //   type: 'combo-combined',
        //   comboPadding: 60,
        //   // innerLayout: new RandomLayout({
        //   //   width: 160,
        //   //   height: 160,
        //   //   center: [0, 0]
        //   // }),
        //   innerLayout: new ForceLayout({
        //     width: 160,
        //     height: 160,
        //     center: [0, 0]
        //   }),
        //   outerLayout: new CircularLayout({
        //     radius: 300,
        //     startAngle: 0,
        //     endAngle: 2 * Math.PI,
        //     divisions: 1,
        //     ordering: 'topology'
        //   })
        // },
        // layout: {
        //   // D3-FORCE with custom combo boundary enforcement
        //   type: 'd3-force',
        //   preventOverlap: true,
        //   nodeSize: 30,
        //   linkDistance: 150,
        //   nodeStrength: -300,
        //   edgeStrength: 0.2,
        // },
        // layout: {
        //   // SIMPLE FORCE LAYOUT
        //   type: 'force-atlas2',
        //   preventOverlap: true,
        //   nodeSize: 30,
        //   // linkDistance: 150,
        //   // nodeStrength: -300,
        //   // edgeStrength: 0.2,
        //   // collideStrength: 1
        // },
        node: {
          style: {
            // size: 20,
            fill: (d) => d.data?.fill || '#C6E5FF',
            stroke: (d) => d.data?.stroke || '#fff',
            lineWidth: 2,
            // labelText: (d) => d.id,
            // labelFill: '#000',
            // labelFontSize: 10,
            // labelOffsetY: 25
          }
        },
        edge: {
          style: {
            stroke: '#666666',
            lineWidth: 1,
            endArrow: true
          }
        },
        combo: {
          style: {
            fill: (d) => d.data?.fill || '#E8F4FD',
            stroke: (d) => d.data?.stroke || '#5B8FF9',
            lineWidth: 2,
            lineDash: (d) => {
              if (d.id.startsWith('app-')) return [3, 3];        // Short dash for apps
              if (d.id.startsWith('cluster-')) return [8, 4];     // Medium dash for clusters
              return [5, 5];                                       // Default dash for private network
            },
            // labelText: (d) => d.data?.label || d.id,
            // labelFontSize: (d) => {
            //   if (d.id === 'private-network') return 16;          // Largest for private network
            //   if (d.id.startsWith('cluster-')) return 14;         // Medium for clusters
            //   return 12;                                           // Smallest for apps
            // },
            // labelOffsetY: 20,
            opacity: 0.6,
            // radius: 10,
            // padding: [-5, -5, -5, -5]  // Minimal padding for tight combo fit
          }
        },
        behaviors: ['collapse-expand', 'drag-element', 'drag-canvas', 'zoom-canvas'],
        autoFit: 'view'
      });

      // Set up event handlers
      this.graph.on('node:click', (e) => {
        console.log('Node click event:', e);
        // G6 v5 event structure
        const nodeId = e.target?.id || e.itemId;
        if (nodeId) {
          // Find the node data by ID
          const nodeData = this.graph.getNodeData(nodeId);
          console.log('Node data for ID', nodeId, ':', nodeData);
          if (nodeData && nodeData.originalData) {
            // Emit the originalData which now includes the ID
            this.$emit('node-clicked', nodeData.originalData, e.originalEvent?.shiftKey || false);
          }
        }
      });

      this.graph.on('viewportchange', () => {
        this.$emit('zoom-change', this.graph.getZoom());
      });

      console.log('G6 initialized successfully');

      // Expose console helper functions to global scope
      window.expandAllApplications = this.expandAllApplications;
      window.collapseAllApplications = this.collapseAllApplications;
      window.expandAllClusters = this.expandAllClusters;
      window.collapseAllClusters = this.collapseAllClusters;
      console.log('Console functions available: expandAllApplications(), collapseAllApplications(), expandAllClusters(), collapseAllClusters()');

      // Render the empty graph
      this.graph.render();

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

      console.log(`Updating graph with ${Object.keys(data.vertices).length} nodes and ${data.edges.length} edges`);

      // Classify nodes as public or private
      const publicNodes = [];
      const privateNodes = [];

      Object.entries(data.vertices).forEach(([id, vertex]) => {
        const isPublic = vertex.public_ip === true || vertex.public_ip === 'true';

        if (isPublic) {
          publicNodes.push({ id, vertex });
        } else {
          privateNodes.push({ id, vertex });
        }
      });

      console.log(`Classified nodes: ${privateNodes.length} private, ${publicNodes.length} public`);

      // Group private nodes by cluster first, then by app_name
      const clusterGroups = {};
      privateNodes.forEach(({ id, vertex }) => {
        const cluster = vertex.cluster || 'unknown';
        const appName = vertex.app_name || 'unknown-app';
        
        if (!clusterGroups[cluster]) {
          clusterGroups[cluster] = {};
        }
        if (!clusterGroups[cluster][appName]) {
          clusterGroups[cluster][appName] = [];
        }
        clusterGroups[cluster][appName].push({ id, vertex });
      });

      const clusterCount = Object.keys(clusterGroups).length;
      const totalApps = Object.values(clusterGroups).reduce((total, cluster) => total + Object.keys(cluster).length, 0);
      console.log(`Found ${clusterCount} clusters with ${totalApps} total application groups:`, 
        Object.entries(clusterGroups).map(([cluster, apps]) => `${cluster}: [${Object.keys(apps).join(', ')}]`));

      // Prepare G6 data structure
      const nodes = [];
      const edges = [];
      const combos = [];

      // Create combo for private network if we have private nodes
      if (privateNodes.length > 0) {
        combos.push({
          id: 'private-network',
          // style: {
          //   collapsed: true,
          // },
          data: {
            label: `Private Network (${clusterCount} clusters, ${totalApps} apps)`
          }
        });
      }

      // Create combos for each cluster within private network
      Object.entries(clusterGroups).forEach(([clusterName, clusterApps]) => {
        const clusterComboId = `cluster-${clusterName}`;
        const appCount = Object.keys(clusterApps).length;
        
        combos.push({
          id: clusterComboId,
          combo: 'private-network',  // Cluster combos are inside private network
          data: {
            label: `${clusterName} (${appCount} apps)`,
            fill: '#E8F4FD',  // Light blue for clusters
            stroke: '#5B8FF9'
          }
        });

        // Create combos for each application within this cluster
        Object.entries(clusterApps).forEach(([appName, appNodes]) => {
          const appComboId = `app-${clusterName}-${appName}`;
          combos.push({
            id: appComboId,
            combo: clusterComboId,  // Application combos are inside cluster combos
            // style: {
            //   collapsed: true,  // Start collapsed
            // },
            data: {
              label: `${appName} (${appNodes.length} nodes)`,
              fill: '#FFE6CC',  // Orange for app combos
              stroke: '#FF9933'
            }
          });
        });
      });

      // Add public nodes (no combo)
      publicNodes.forEach(({ id, vertex }) => {
        nodes.push({
          id: id,
          data: {
            label: this.getNodeLabel(vertex),
            fill: this.getNodeColor(vertex.type),
            stroke: '#fff',
            lineWidth: 2,
            size: 20,
            originalData: { ...vertex, id }  // Include ID in originalData
          }
        });
      });

      // Add private nodes to their respective app combos
      Object.entries(clusterGroups).forEach(([clusterName, clusterApps]) => {
        Object.entries(clusterApps).forEach(([appName, appNodes]) => {
          const appComboId = `app-${clusterName}-${appName}`;
          appNodes.forEach(({ id, vertex }) => {
            nodes.push({
              id: id,
              combo: appComboId,  // Node belongs to app combo within cluster
              data: {
                label: this.getNodeLabel(vertex),
                fill: this.getNodeColor(vertex.type),
                stroke: '#fff',
                lineWidth: 2,
                size: 20,
                originalData: { ...vertex, id }  // Include ID in originalData
              }
            });
          });
        });
      });

      // Add all edges
      data.edges.forEach((edge, index) => {
        edges.push({
          id: `edge-${index}`,
          source: edge.start_node,
          target: edge.end_node,
          data: {
            stroke: '#e2e2e2',
            lineWidth: 1
          }
        });
      });

      console.log(`Adding ${nodes.length} nodes, ${edges.length} edges, ${combos.length} combos to G6`);

      // Update graph data using the correct G6 v5 API
      const graphData = {
        nodes: nodes,
        edges: edges,
        combos: combos
      };

      // Clear and set new data
      this.graph.setData(graphData);
      this.graph.render();
      
      // // Second pass: collapse application combos after rendering
      // setTimeout(() => {
      //   console.log('Collapsing application combos...');
      //   let collapseCount = 0;
      //   Object.entries(clusterGroups).forEach(([clusterName, clusterApps]) => {
      //     Object.keys(clusterApps).forEach(appName => {
      //       const appComboId = `app-${clusterName}-${appName}`;
      //       try {
      //         // Update the combo data to set it as collapsed
      //         const comboData = this.graph.getComboData(appComboId);
      //         if (comboData) {
      //           this.graph.updateComboData([
      //             {
      //               id: appComboId,
      //               ...comboData,
      //               style: {
      //                 ...comboData.style,
      //                 collapsed: true
      //               }
      //             }
      //           ]);
      //           collapseCount++;
      //         }
      //       } catch (e) {
      //         console.log(`Could not collapse combo ${appComboId}:`, e);
      //       }
      //     });
      //   });
      //   this.graph.render();
      //   console.log(`Collapsed ${collapseCount} application combos`);
      // }, 100);  // Longer delay to ensure force layout has positioned nodes

      // Emit rendering complete
      this.$emit('rendering-complete', {
        nodeCount: nodes.length,
        linkCount: edges.length
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
      if (this.graph) {
        const zoom = this.graph.getZoom();
        this.graph.zoomTo(zoom * 1.3);
      }
    },

    zoomOut() {
      if (this.graph) {
        const zoom = this.graph.getZoom();
        this.graph.zoomTo(zoom * 0.7);
      }
    },

    resetView() {
      if (this.graph) {
        this.graph.fitView();
      }
    },

    resetNodePositions() {
      if (this.graph) {
        // Re-run the layout
        // this.graph.layout({
        //   type: 'combo-combined',
        //   comboPadding: 50,
        //   innerLayout: new ConcentricLayout({
        //     sortBy: 'id',
        //     nodeSize: 20,
        //     clockwise: true,
        //     preventOverlap: true,
        //     minNodeSpacing: 25
        //   }),
        //   outerLayout: new ForceLayout({
        //     gravity: 1,
        //     factor: 2,
        //     preventOverlap: true,
        //     nodeSize: 30,
        //     linkDistance: 200,
        //     nodeStrength: -800,
        //     edgeStrength: 0.1
        //   })
        // });
      }
    },

    // Functions for expanding/collapsing all application combos
    expandAllApplications() {
      if (!this.graph) return;
      
      console.log('Expanding all application combos...');
      const data = this.graph.getData();
      const appCombos = data.combos?.filter(combo => combo.id.startsWith('app-')) || [];
      
      appCombos.forEach(combo => {
        try {
          const comboData = this.graph.getComboData(combo.id);
          if (comboData) {
            this.graph.updateComboData([{
              id: combo.id,
              ...comboData,
              style: { ...comboData.style, collapsed: false }
            }]);
          }
        } catch (e) {
          console.log(`Could not expand combo ${combo.id}:`, e);
        }
      });
      
      this.graph.render();
      console.log(`Expanded ${appCombos.length} application combos`);
    },

    collapseAllApplications() {
      if (!this.graph) return;
      
      console.log('Collapsing all application combos...');
      const data = this.graph.getData();
      const appCombos = data.combos?.filter(combo => combo.id.startsWith('app-')) || [];
      
      appCombos.forEach(combo => {
        try {
          const comboData = this.graph.getComboData(combo.id);
          if (comboData) {
            this.graph.updateComboData([{
              id: combo.id,
              ...comboData,
              style: { ...comboData.style, collapsed: true }
            }]);
          }
        } catch (e) {
          console.log(`Could not collapse combo ${combo.id}:`, e);
        }
      });
      
      this.graph.render();
      console.log(`Collapsed ${appCombos.length} application combos`);
    },

    // Functions for expanding/collapsing all cluster combos
    expandAllClusters() {
      if (!this.graph) return;
      
      console.log('Expanding all cluster combos...');
      const data = this.graph.getData();
      const clusterCombos = data.combos?.filter(combo => combo.id.startsWith('cluster-')) || [];
      
      clusterCombos.forEach(combo => {
        try {
          const comboData = this.graph.getComboData(combo.id);
          if (comboData) {
            this.graph.updateComboData([{
              id: combo.id,
              ...comboData,
              style: { ...comboData.style, collapsed: false }
            }]);
          }
        } catch (e) {
          console.log(`Could not expand combo ${combo.id}:`, e);
        }
      });
      
      this.graph.render();
      console.log(`Expanded ${clusterCombos.length} cluster combos`);
    },

    collapseAllClusters() {
      if (!this.graph) return;
      
      console.log('Collapsing all cluster combos...');
      const data = this.graph.getData();
      const clusterCombos = data.combos?.filter(combo => combo.id.startsWith('cluster-')) || [];
      
      clusterCombos.forEach(combo => {
        try {
          const comboData = this.graph.getComboData(combo.id);
          if (comboData) {
            this.graph.updateComboData([{
              id: combo.id,
              ...comboData,
              style: { ...comboData.style, collapsed: true }
            }]);
          }
        } catch (e) {
          console.log(`Could not collapse combo ${combo.id}:`, e);
        }
      });
      
      this.graph.render();
      console.log(`Collapsed ${clusterCombos.length} cluster combos`);
    }
  }
};
</script>

<style>
#g6-container {
  width: 100vw;
  height: 100vh;
  background-color: #f8f9fa;
  border: 1px solid #ccc;
}
</style>