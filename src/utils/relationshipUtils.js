/**
 * Copyright 2025 Lightwire, LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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

/**
 * Find relationships between components in a component subgraph
 * @param {Array} components Array of components to find relationships for
 * @param {Object} rawGraphData The raw graph data containing all vertices and edges
 * @returns {Array} Array of link objects with source and target IDs
 */
export function findComponentRelationships(components, rawGraphData) {
    if (!components || !components.length || !rawGraphData || !rawGraphData.edges) {
        return [];
    }

    const links = [];
    const componentMap = {};

    // Create a map of component IDs to their index position in the nodes array
    // This is important because the D3 force layout works with indices
    components.forEach((component, index) => {
        // Use originalData if available, otherwise use the component itself
        const componentData = component.originalData || component;
        
        // Store the component's data and its index in the nodes array
        componentMap[index] = {
            data: componentData,
            index: index
        };
    });

    // For each component, find relationships with other components in this set
    Object.entries(componentMap).forEach(([sourceIndex, sourceInfo]) => {
        const sourceComponent = sourceInfo.data;
        
        // Skip if no valid component data
        if (!sourceComponent) return;
        
        // Find all relationships for this component in the raw graph data
        const relationships = processNodeRelationships(sourceComponent, rawGraphData, 'both');
        
        // For each relationship, check if the target is another component in our set
        relationships.forEach(rel => {
            const targetNodeId = rel.nodeId;
            
            // Check if any component in our map has this as target
            for (const [targetIndex, targetInfo] of Object.entries(componentMap)) {
                if (sourceIndex === targetIndex) continue; // Skip self-relationships
                
                const targetComponent = targetInfo.data;
                if (!targetComponent) continue;
                
                // Check if this target component is the one from the relationship
                const targetComponentId = targetComponent.id || 
                    findNodeIdByProperties(targetComponent, rawGraphData);
                    
                if (targetComponentId === targetNodeId) {
                    // Found a relationship between two components in our set
                    links.push({
                        source: parseInt(sourceIndex),
                        target: parseInt(targetIndex),
                        value: 1,
                        type: rel.type
                    });
                    break; // Move to next relationship
                }
            }
        });
    });
    
    return links;
}