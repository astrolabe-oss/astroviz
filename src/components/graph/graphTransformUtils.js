/**
 * Copyright 2025 Lightwire, LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// src/components/graph/graphTransformUtils.js

/**
 * Transform Neo4j graph data into hierarchical structure for visualization
 * @param {Object} data - Raw graph data from Neo4j with vertices and edges
 * @param {Object} nodeColors - Map of node types to colors
 * @returns {Object} Transformed data with hierarchy and filtered edges
 */
export function transformGraphDataForVisualization(data, nodeColors) {
  if (!data || !data.vertices || !data.edges) {
    console.log('Cannot transform graph: missing graph data');
    return null;
  }

  console.log(`Transforming graph with ${Object.keys(data.vertices).length} nodes and ${data.edges.length} edges`);

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

  // Group private nodes by cluster first, then by app_name (excluding application nodes)
  // Also preserve application node data for click handling
  const clusterGroups = {};
  const applicationDataMap = new Map(); // Map: app_name -> application node data
  
  privateNodes.forEach(({ id, vertex }) => {
    const cluster = vertex.cluster || 'unknown';
    const appName = vertex.app_name || 'unknown-app';
    
    // Store application node data for later lookup
    if (vertex.type?.toLowerCase() === 'application') {
      applicationDataMap.set(appName, vertex);
      return; // Skip application nodes from grouping
    }
    
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
  console.log(`Found ${clusterCount} clusters with ${totalApps} total application groups`);

  // Transform into vertices/edges format for GraphRenderer
  const vertices = {};
  const edges = [];

  // Create Internet Boundary as the root container for private network
  if (privateNodes.length > 0) {
    vertices['internet-boundary'] = {
      label: 'Internet Boundary',
      type: 'group',
      parentId: null,
      style: {
        fill: 'none',
        stroke: '#4A98E3',
        strokeDasharray: '10,6,2,6',
        strokeWidth: 4  // Make it thicker for visibility
      },
      // Clean data for NodeDetails panel
      data: {
        label: 'Internet Boundary',
        type: 'group'
      }
    };

    // Create private network group inside Internet Boundary
    vertices['private-network'] = {
      label: `Private Network (${clusterCount} clusters, ${totalApps} apps)`,
      type: 'group',
      parentId: 'internet-boundary',
      style: {
        fill: '#f0f0f0',
        stroke: '#888',
        strokeWidth: 2,
        opacity: 0.6
      },
      // Clean data for NodeDetails panel
      data: {
        label: `Private Network (${clusterCount} clusters, ${totalApps} apps)`,
        type: 'group'
      }
    };
  }

  // Create cluster groups within private network
  Object.entries(clusterGroups).forEach(([clusterName, clusterApps]) => {
    const clusterGroupId = `cluster-${clusterName}`;
    const appCount = Object.keys(clusterApps).length;
    
    vertices[clusterGroupId] = {
      label: `Cluster: ${clusterName} (${appCount} apps)`,
      type: 'group',
      parentId: 'private-network',
      style: {
        fill: '#E8F4FD',
        stroke: '#5B8FF9',
        strokeWidth: 2,
        opacity: 0.6
      },
      // Clean data for NodeDetails panel
      data: {
        label: `Cluster: ${clusterName} (${appCount} apps)`,
        type: 'group',
        name: clusterName
      }
    };

    // Create application groups within clusters
    Object.entries(clusterApps).forEach(([appName, appNodes]) => {
      const appGroupId = `app-${clusterName}-${appName}`;
      
      vertices[appGroupId] = {
        label: `App: ${appName} (${appNodes.length} nodes)`,
        type: 'group',
        name: appName,
        app_name: appName,
        parentId: clusterGroupId,
        style: {
          fill: '#FFE6CC',
          stroke: '#FF9933',
          strokeWidth: 2,
          opacity: 0.6
        },
        // Clean data for NodeDetails panel
        data: {
          label: `App: ${appName} (${appNodes.length} nodes)`,
          type: 'group',
          name: appName,
          app_name: appName,
          children: appNodes.map(({ id, vertex }) => ({
            id: id,
            name: vertex.name || id,
            type: vertex.type,
            address: vertex.address
          }))
        }
      };

      // Add nodes to their application groups
      appNodes.forEach(({ id, vertex }) => {
        // Clean separation: database data nested, app properties at root
        vertices[id] = {
          // Application properties (for visualization/interaction)
          id: id,
          label: vertex.label || vertex.name || id,
          type: vertex.type,
          parentId: appGroupId,
          style: {
            fill: getNodeColor(vertex.type, nodeColors)
          },
          // Clean database properties (for end users)
          data: vertex
        };
      });
    });
  });

  // Add public nodes (no parent)
  publicNodes.forEach(({ id, vertex }) => {
    // Clean separation: database data nested, app properties at root
    vertices[id] = {
      // Application properties (for visualization/interaction)
      id: id,
      label: vertex.label || vertex.name || id,
      type: vertex.type,
      parentId: null,
      style: {
        fill: getNodeColor(vertex.type, nodeColors)
      },
      // Clean database properties (for end users)
      data: vertex
    };
  });

  // Transform edges, filtering out edges that involve application nodes
  // applications are rendered as groups, not individual nodes
  data.edges.forEach((edge) => {
    const sourceVertex = data.vertices[edge.start_node];
    const targetVertex = data.vertices[edge.end_node];
    
    // Skip edges that involve application nodes since we no longer render them as vertices
    const isSourceApplication = sourceVertex?.type?.toLowerCase() === 'application';
    const isTargetApplication = targetVertex?.type?.toLowerCase() === 'application';
    
    if (!isSourceApplication && !isTargetApplication) {
      edges.push({
        source: edge.start_node,
        target: edge.end_node
      });
    }
  });

  const graphData = { 
    vertices, 
    edges,
    applicationDataMap,  // Include application data for click handling
    originalVertices: data.vertices  // Preserve original clean database data
  };
  
  console.log(`Transformed graph data: ${Object.keys(vertices).length} vertices, ${edges.length} edges`);
  
  return graphData;
}

/**
 * Get the color for a node type
 * @param {string} type - The node type
 * @param {Object} nodeColors - Map of node types to colors
 * @returns {string} The color for the node type
 */
function getNodeColor(type, nodeColors) {
  return nodeColors[type] || '#999';
}