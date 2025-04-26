/**
 * Copyright 2025 Lightwire, LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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

    // First, try to find exact match on multiple properties if they exist
    for (const [id, vertex] of Object.entries(graphData.vertices)) {
        // Must match the node type
        if (vertex.type === nodeProps.type) {
            // For exact match, check if all available unique identifiers match
            if (nodeProps.name && nodeProps.address) {
                // If we have both name and address, require both to match for uniqueness
                if (vertex.name === nodeProps.name && vertex.address === nodeProps.address) {
                    return id;
                }
            } else if (nodeProps.name) {
                // If we have only name, try to match on that exactly
                if (vertex.name === nodeProps.name) {
                    return id;
                }
            } else if (nodeProps.address) {
                // If we have only address, try to match on that exactly
                if (vertex.address === nodeProps.address) {
                    return id;
                }
            } else if (nodeProps.app_name) {
                // If we have only app_name, match on that
                if (vertex.app_name === nodeProps.app_name) {
                    // But if we're matching only on app_name, we need additional context
                    // If the node is a Deployment, make sure we're not returning a wrong matching Deployment
                    if (nodeProps.type === 'Deployment' && nodeProps.id) {
                        // If we have an ID from the original data, use that for exact matching
                        if (id === nodeProps.id) {
                            return id;
                        }
                    } else {
                        return id;
                    }
                }
            }
        }
    }

    // If we haven't found a match, check if nodeProps has a nodeId property
    // This can happen if we're working with an object from relationship data
    if (nodeProps.nodeId) {
        // Check if this ID exists in our graph
        if (graphData.vertices[nodeProps.nodeId]) {
            return nodeProps.nodeId;
        }
    }

    // If we still don't have a match, try the original OR approach as a fallback
    for (const [id, vertex] of Object.entries(graphData.vertices)) {
        if (vertex.type === nodeProps.type) {
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