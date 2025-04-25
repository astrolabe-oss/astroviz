// src/utils/relationshipUtils.js
import { findNodeIdByProperties, getNodeDisplayName } from './nodeUtils';

/**
 * Process relationships for a node
 * @param {Object} node The node to get relationships for
 * @param {Object} graphData The graph data containing vertices and edges
 * @param {string} direction The direction of relationships to get: 'outgoing', 'incoming', or 'both'
 * @returns {Array} Array of processed relationships
 */
export function processNodeRelationships(node, graphData, direction = 'outgoing') {
    if (!node || !graphData || !graphData.edges) {
        return [];
    }

    const nodeId = findNodeIdByProperties(node, graphData);
    if (!nodeId) return [];

    let relationships = [];

    if (direction === 'outgoing' || direction === 'both') {
        // Find outgoing edges
        const outgoingEdges = graphData.edges.filter(edge =>
            edge.start_node === nodeId
        );

        // Enrich outgoing edges with node details
        const outRelationships = outgoingEdges.map(edge => {
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

        relationships = [...outRelationships];
    }

    if (direction === 'incoming' || direction === 'both') {
        // Find incoming edges
        const incomingEdges = graphData.edges.filter(edge =>
            edge.end_node === nodeId
        );

        // Enrich incoming edges with node details
        const inRelationships = incomingEdges.map(edge => {
            const otherNodeId = edge.start_node;
            const otherNode = graphData.vertices[otherNodeId];

            return {
                type: edge.type,
                direction: 'incoming',
                nodeId: otherNodeId,
                nodeName: getNodeDisplayName(otherNode),
                nodeType: otherNode.type,
                properties: edge.properties || {}
            };
        });

        relationships = [...relationships, ...inRelationships];
    }

    return relationships;
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