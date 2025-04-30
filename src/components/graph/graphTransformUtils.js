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
 * Transform graph data to application level view based on app_name attribute
 * @param {Object} graphData The filtered graph data
 * @returns {Object} Transformed data for visualization
 */
export function transformToApplicationView(graphData) {
    console.log("UTILS: transformToApplicationView called");

    // Create a map of app_name -> virtual application node
    const appNameMap = {};
    // Create a map of nodeId -> app_name for quick lookups
    const nodeToAppNameMap = {};

    // First pass - identify all unique app_names and create virtual application nodes
    Object.entries(graphData.vertices).forEach(([id, vertex]) => {
        // Determine the application identifier with fallbacks
        let appIdentifier;
        if (vertex.app_name) {
            appIdentifier = vertex.app_name;
        } else if (vertex.name) {
            appIdentifier = vertex.name;
        } else if (vertex.address) {
            appIdentifier = vertex.address;
        } else {
            appIdentifier = "ERROR";
        }
        
        // Map this node ID to its app identifier
        nodeToAppNameMap[id] = appIdentifier;
        
        // Create a virtual application node if it doesn't exist yet
        if (!appNameMap[appIdentifier]) {
            appNameMap[appIdentifier] = {
                id: `app-${appIdentifier}`, // Create a virtual ID for the application
                label: `App: ${appIdentifier}`,
                type: 'Application',
                app_name: appIdentifier,
                data: {
                    type: 'Application',
                    app_name: appIdentifier,
                    name: appIdentifier,
                    virtual: true, // Mark as a virtual node
                    components: [] // Will store all component nodes
                }
            };
        }
        
        // Add this node as a component of the application
        appNameMap[appIdentifier].data.components.push({
            id,
            type: vertex.type,
            ...vertex
        });
    });

    // Intermediate pass - calculate aggregated properties for each application
    Object.values(appNameMap).forEach(appNode => {
        const components = appNode.data.components;
        
        // Skip if no components
        if (!components.length) return;
        
        // Calculate platform aggregation (same or 'mixed')
        const platforms = new Set(components.map(c => c.platform).filter(Boolean));
        appNode.data.platform = platforms.size === 1 ? [...platforms][0] : 'mixed';
        
        // Calculate provider aggregation (same or 'mixed')
        const providers = new Set(components.map(c => c.provider).filter(Boolean));
        appNode.data.provider = providers.size === 1 ? [...providers][0] : 'mixed';
        
        // Set public_ip to true if any component has public_ip
        appNode.data.public_ip = components.some(c => c.public_ip === true);
        
        // Add component type counts
        const typeCounts = {};
        components.forEach(c => {
            typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
        });
        appNode.data.typeCounts = typeCounts;
        
        // Add aggregated properties to the top level for easier access
        appNode.platform = appNode.data.platform;
        appNode.provider = appNode.data.provider;
        appNode.public_ip = appNode.data.public_ip;
        appNode.componentCount = components.length;
    });

    // Final pass - create app-to-app connections based on any connections between components
    const appConnections = {};
    graphData.edges.forEach(edge => {
        const sourceAppIdentifier = nodeToAppNameMap[edge.start_node];
        const targetAppIdentifier = nodeToAppNameMap[edge.end_node];

        // Only create connections if both nodes have identifiers and they're different
        if (sourceAppIdentifier && targetAppIdentifier && sourceAppIdentifier !== targetAppIdentifier) {
            const sourceAppId = `app-${sourceAppIdentifier}`;
            const targetAppId = `app-${targetAppIdentifier}`;
            const connKey = `${sourceAppId}-${targetAppId}`;
            
            // Create connection if it doesn't exist yet
            if (!appConnections[connKey]) {
                appConnections[connKey] = {
                    source: sourceAppId,
                    target: targetAppId,
                    type: edge.type,
                    // Store information about what kind of edge this represents
                    data: {
                        edgeType: edge.type,
                        connectedComponents: [{
                            sourceId: edge.start_node,
                            targetId: edge.end_node
                        }]
                    }
                };
            } else {
                // Add this connection to the existing edge's data
                appConnections[connKey].data.connectedComponents.push({
                    sourceId: edge.start_node,
                    targetId: edge.end_node
                });
            }
        }
    });

    const nodes = Object.values(appNameMap);
    const links = Object.values(appConnections);

    console.log(`UTILS: Application view has ${nodes.length} nodes and ${links.length} links`);
    console.log("UTILS: Virtual application nodes created:", nodes.map(n => n.app_name).join(", "));
    
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