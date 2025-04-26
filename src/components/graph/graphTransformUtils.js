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
export function transformToDetailedView(graphData) {
    console.log("UTILS: transformToDetailedView called");

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
            type: edge.type
        });
    });

    console.log(`UTILS: Detailed view has ${nodes.length} nodes and ${links.length} links`);
    return { nodes, links };
}

/**
 * Transform graph data to application level view
 * @param {Object} graphData The filtered graph data
 * @returns {Object} Transformed data for visualization
 */
export function transformToApplicationView(graphData) {
    console.log("UTILS: transformToApplicationView called");

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

    console.log(`UTILS: Application view has ${nodes.length} nodes and ${links.length} links`);
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