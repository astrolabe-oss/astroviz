// src/utils/relationshipUtils.js
import { findNodeIdByProperties, getNodeDisplayName } from './nodeUtils';

/**
 * Process relationships for a node
 * @param {Object} node The node to get relationships for
 * @param {Object} graphData The graph data containing vertices and edges
 * @returns {Array} Array of processed relationships
 */
export function processNodeRelationships(node, graphData) {
    if (!node || !graphData || !graphData.edges) {
        return [];
    }

    const nodeId = findNodeIdByProperties(node, graphData);
    if (!nodeId) return [];

    // Find only outgoing edges as requested
    const relationships = graphData.edges.filter(edge =>
        edge.start_node === nodeId
    );

    // Enrich edges with node details
    return relationships.map(edge => {
        const otherNodeId = edge.end_node;
        const otherNode = graphData.vertices[otherNodeId];

        return {
            type: edge.type,
            direction: 'outgoing',
            nodeId: otherNodeId,
            nodeName: getNodeDisplayName(otherNode),
            nodeType: otherNode.type,
            properties: edge.properties || {}
        };
    });
}

/**
 * Group relationships by type
 * @param {Array} relationships Array of relationship objects
 * @returns {Array} Array of relationship groups
 */
export function groupRelationshipsByType(relationships) {
    if (!relationships || !relationships.length) return [];

    // Create an object to hold the grouped relationships
    const groupedByType = {};

    relationships.forEach(rel => {
        const groupKey = rel.type;

        if (!groupedByType[groupKey]) {
            groupedByType[groupKey] = {
                type: groupKey,
                relationships: []
            };
        }

        groupedByType[groupKey].relationships.push(rel);
    });

    // Convert to array and sort alphabetically by relationship type
    return Object.values(groupedByType).sort((a, b) => a.type.localeCompare(b.type));
}