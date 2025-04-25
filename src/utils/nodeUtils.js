// src/utils/nodeUtils.js

/**
 * Node type color mapping
 */
export const NODE_TYPE_COLORS = {
    'Application': '#F9696E',
    'Deployment': '#F2A3B3',
    'Compute': '#5DCAD1',
    'Resource': '#74B56D',
    'TrafficController': '#4A98E3',
    'InternetIP': '#E0E0E0',
};

/**
 * Get color for node type badge
 * @param {string} nodeType Type of the node
 * @returns {string} CSS color
 */
export function getNodeTypeColor(nodeType) {
    return NODE_TYPE_COLORS[nodeType] || '#CCCCCC';
}

/**
 * Get display name for a node
 * @param {Object} node Node data
 * @returns {string} Display name
 */
export function getNodeDisplayName(node) {
    if (!node) return 'Unknown';

    if (node.name) return node.name;
    if (node.type === 'InternetIP' && node.address) return node.address;
    if (node.app_name) return `${node.type}: ${node.app_name}`;
    if (node.address) return `${node.type}: ${node.address}`;

    return `${node.type} node`;
}

/**
 * Find node ID by comparing properties with given node properties
 * @param {Object} nodeProps Node properties to find
 * @param {Object} graphData Graph data containing vertices and edges
 * @returns {string|null} Node ID if found, null otherwise
 */
export function findNodeIdByProperties(nodeProps, graphData) {
    if (!nodeProps || !graphData || !graphData.vertices) return null;

    // If the node has type and unique identifiers, we can look for it
    for (const [id, vertex] of Object.entries(graphData.vertices)) {
        // Compare type and check if we match key properties
        if (vertex.type === nodeProps.type) {
            // For different node types, check their common identifiers
            if (
                (nodeProps.name && vertex.name === nodeProps.name) ||
                (nodeProps.address && vertex.address === nodeProps.address) ||
                (nodeProps.app_name && vertex.app_name === nodeProps.app_name)
            ) {
                return id;
            }
        }
    }

    return null;
}