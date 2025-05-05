/**
 * Copyright 2025 Lightwire, LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// src/components/graph/graphTransformUtils.js

/**
 * Transform graph data to detailed view
 * @param {Object} graphData The filtered graph data
 * @returns {Object} Transformed data for visualization
 */
export function transformNeo4JDataForD3(graphData) {
    console.log("UTILS: transformNeo4JDataForD3 called");

    // Create nodes for visualization
    const nodes = [];
    Object.entries(graphData.vertices).forEach(([id, vertex]) => {
        nodes.push({
            id,
            label: getNodeLabel(vertex),
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
            type: edge.type,
            data: {
                edgeType: edge.type,
                connectedComponents: edge.connectedComponents
            }
        });
    });

    console.log(`UTILS: Detailed view has ${nodes.length} nodes and ${links.length} links`);
    return { nodes, links };
}

/**
 * Transform graph data for Cytoscape visualization
 * @param {Object} graphData The filtered graph data
 * @returns {Object} Transformed data for Cytoscape
 */
export function transformNeo4JDataForCytoscape(graphData, filters) {
    console.log("UTILS: transformNeo4JDataForCytoscape called with:", graphData);
    console.log("UTILS: graphData has vertices:", !!graphData.vertices, "edges:", !!graphData.edges);
    console.log("UTILS: graphData.vertices keys:", graphData.vertices ? Object.keys(graphData.vertices).length : 0);
    console.log("UTILS: graphData.edges length:", graphData.edges ? graphData.edges.length : 0);

    if (!graphData || !graphData.vertices || !graphData.edges) {
        console.warn("UTILS: Invalid graphData structure for Cytoscape");
        return { nodes: [], links: [] };
    }

    // Create nodes for visualization
    const nodes = [];
    Object.entries(graphData.vertices).forEach(([id, vertex]) => {
        nodes.push({
            id,
            label: getNodeLabel(vertex),
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
            type: edge.type,
            data: {
                edgeType: edge.type,
                connectedComponents: edge.connectedComponents
            }
        });
    });

    console.log(`UTILS: Cytoscape view has ${nodes.length} nodes and ${links.length} links`);
    return { nodes, links };
}

/**
 * Create a meaningful label for a node based on its type and properties
 * @param {Object} vertex The vertex data
 * @returns {string} A label for display
 */
export function getNodeLabel(vertex) {
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
}
