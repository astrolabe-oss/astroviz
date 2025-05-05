/**
 * Copyright 2025 Lightwire, LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// src/services/neo4jService.js
import neo4j from 'neo4j-driver';
import config from '@/config';

/**
 * Service to handle Neo4j database connection and queries
 */
class Neo4jService {
    constructor() {
        this.driver = null;
    }

    /**
     * Connect to Neo4j database
     * @returns {Promise} Promise that resolves when connection is successful
     */
    connect() {
        console.log("NEO4J SERVICE: Attempting to connect...");
        const { uri, username, password, database } = config.neo4j;
        console.log(`NEO4J SERVICE: Using URI: ${uri}`);

        // Create driver instance
        const driverConfig = {
            maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
            maxConnectionPoolSize: 50,
            connectionAcquisitionTimeout: 30 * 1000 // 30 seconds
        };

        if (database) {
            driverConfig.database = database;
            console.log(`NEO4J SERVICE: Using database: ${database}`);
        }

        try {
            console.log("NEO4J SERVICE: Creating driver...");
            this.driver = neo4j.driver(
                uri,
                neo4j.auth.basic(username, password),
                driverConfig
            );

            console.log("NEO4J SERVICE: Driver created, verifying connectivity...");
            // Test connection
            return this.driver.verifyConnectivity()
                .then(() => {
                    console.log("NEO4J SERVICE: Connection verified successfully");
                    return Promise.resolve();
                })
                .catch(error => {
                    console.error("NEO4J SERVICE: Connection verification failed", error);
                    throw error;
                });
        } catch (error) {
            console.error("NEO4J SERVICE: Failed to create driver", error);
            throw error;
        }
    }

    /**
     * Close the Neo4j connection
     */
    disconnect() {
        if (this.driver) {
            this.driver.close();
            this.driver = null;
        }
    }

    /**
     * Check if connected to Neo4j
     * @returns {boolean} Connection status
     */
    isConnected() {
        return this.driver !== null;
    }

    /**
     * Create a session for running queries
     * @returns {Session} Neo4j session
     */
    getSession() {
        console.log("NEO4J SERVICE: Creating session...");
        if (!this.isConnected()) {
            console.error("NEO4J SERVICE: Not connected to Neo4j database");
            throw new Error('Not connected to Neo4j database');
        }

        const { database } = config.neo4j;
        const sessionConfig = database ? { database } : {};

        console.log("NEO4J SERVICE: Session created");
        return this.driver.session(sessionConfig);
    }

    /**
     * Run a Cypher query
     * @param {string} query The Cypher query to run
     * @param {Object} params Query parameters
     * @returns {Promise<Object>} Query result
     */
    async runQuery(query, params = {}) {
        const session = this.getSession();
        try {
            const result = await session.run(query, params);
            return result;
        } catch (error) {
            console.error("NEO4J SERVICE: Query error", error);
            throw error;
        } finally {
            await session.close();
        }
    }

    /**
     * Fetch the entire graph data
     * @param {Function} progressCallback Optional callback function for reporting progress
     * @returns {Promise<Object>} Promise resolving to vertices and edges
     */
    async fetchGraphData(progressCallback) {
        console.log("NEO4J SERVICE: Starting fetchGraphData...");
        const reportProgress = (status, progress) => {
            console.log(`NEO4J SERVICE: Progress - ${status} (${progress}%)`);
            if (typeof progressCallback === 'function') {
                try {
                    progressCallback(status, progress);
                } catch (error) {
                    console.error("NEO4J SERVICE: Error in progress callback", error);
                }
            }
        };

        try {
            // Get all nodes and relationships in one query for better performance
            reportProgress("Fetching graph data...", 20);

            const query = `
                // Get all nodes with their labels and properties
                MATCH (n)
                WITH collect({
                    id: id(n),
                    labels: labels(n),
                    properties: properties(n)
                }) AS nodes
                
                // Get all relationships
                MATCH (source)-[r]->(target)
                WITH nodes, collect({
                    source: id(source),
                    target: id(target),
                    type: type(r),
                    properties: properties(r)
                }) AS relationships
                
                RETURN nodes, relationships
            `;

            reportProgress("Executing query...", 30);
            const result = await this.runQuery(query);

            if (result.records.length === 0) {
                console.log("NEO4J SERVICE: No data returned");
                return { vertices: {}, edges: [] };
            }

            const record = result.records[0];
            const nodesData = record.get('nodes');
            const relationshipsData = record.get('relationships');

            reportProgress("Processing nodes...", 60);

            // Process nodes
            const vertices = {};
            nodesData.forEach(node => {
                // Use the first label as the type (matching your previous implementation)
                const type = node.labels[0];

                // Convert neo4j int to string for the ID
                const id = node.id.toString();

                // Store node with its properties and type
                vertices[id] = {
                    ...this.processProperties(node.properties),
                    type
                };
            });

            reportProgress("Processing relationships...", 80);

            // Process relationships
            const edges = relationshipsData.map(rel => ({
                start_node: rel.source.toString(),
                end_node: rel.target.toString(),
                type: rel.type,
                properties: this.processProperties(rel.properties)
            }));

            reportProgress("Completing...", 95);

            console.log(`NEO4J SERVICE: Completed with ${Object.keys(vertices).length} vertices and ${edges.length} edges`);
            return { vertices, edges };
        } catch (error) {
            console.error("NEO4J SERVICE: Error in fetchGraphData", error);
            throw error;
        }
    }

    /**
     * Aggregate data for application view by grouping nodes by app_name
     * This separates the data aggregation logic from the visualization transformation
     * @param {Object} graphData The original graph data with vertices and edges
     * @returns {Object} Aggregated data with app nodes and relationships between apps
     */
    aggregateDataForApplicationView(graphData) {
        console.log("NEO4J SERVICE: Aggregating data for application view");

        // Create a map of app_name -> virtual application node
        const appNameMap = {};
        // Create a map of nodeId -> app_name for quick lookups
        const nodeToAppNameMap = {};
        // Track which app identifiers have a real Application node
        const realApplications = new Set();

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
            
            // Track if this is a real Application node
            if (vertex.type === 'Application') {
                realApplications.add(appIdentifier);
            }
            
            // Create a virtual application node if it doesn't exist yet
            if (!appNameMap[appIdentifier]) {
                // If we're creating a node for a real Application, use its ID instead of a generated one
                const isRealApp = vertex.type === 'Application';
                const nodeId = isRealApp ? id : `app-${appIdentifier}`;
                
                appNameMap[appIdentifier] = {
                    id: nodeId,
                    type: 'Application',
                    app_name: appIdentifier,
                    name: appIdentifier,
                    virtual: !isRealApp, // Only mark as virtual if not a real Application
                    components: [] // Will store all component nodes
                };
                
                // If this is a real Application node, copy its properties to the app node
                if (isRealApp) {
                    // Copy all vertex properties to the app node
                    Object.entries(vertex).forEach(([key, value]) => {
                        if (key !== 'type' && key !== 'app_name') { // Don't overwrite these
                            appNameMap[appIdentifier][key] = value;
                        }
                    });
                }
            }
            
            // Only add non-Application nodes as components
            // Application nodes are the containers, not components themselves
            if (vertex.type !== 'Application') {
                appNameMap[appIdentifier].components.push({
                    id,
                    type: vertex.type,
                    ...vertex
                });
            }
        });

        // Intermediate pass - calculate aggregated properties for each application
        Object.values(appNameMap).forEach(appNode => {
            const components = appNode.components;
            
            // Skip if no components
            if (!components.length) return;
            
            // Check if this is a real Application (not virtual)
            const isRealApp = realApplications.has(appNode.app_name);
            
            // Update virtual flag based on whether there's a real Application
            appNode.virtual = !isRealApp;
            
            // Calculate platform aggregation (same or 'mixed')
            const platforms = new Set(components.map(c => c.platform).filter(Boolean));
            appNode.platform = platforms.size === 1 ? [...platforms][0] : 'mixed';
            
            // Calculate provider aggregation (same or 'mixed')
            const providers = new Set(components.map(c => c.provider).filter(Boolean));
            appNode.provider = providers.size === 1 ? [...providers][0] : 'mixed';

            // Calculate provider aggregation (same or 'mixed')
            const protocol_mux = new Set(components.map(c => c.protocol_multiplexor).filter(Boolean));
            appNode.protocol_multiplexor = protocol_mux.size === 1 ? [...protocol_mux][0] : 'MIXED';
            
            // Set public_ip to true if any component has public_ip
            appNode.public_ip = components.some(c => c.public_ip === true);
            
            // Add component type counts
            const typeCounts = {};
            components.forEach(c => {
                typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
            });
            appNode.typeCounts = typeCounts;
            
            // Add component count
            appNode.componentCount = components.length;
        });

        // Final pass - create app-to-app connections based on any connections between components
        const appConnections = [];
        graphData.edges.forEach(edge => {
            const sourceAppIdentifier = nodeToAppNameMap[edge.start_node];
            const targetAppIdentifier = nodeToAppNameMap[edge.end_node];

            // Only create connections if both nodes have identifiers and they're different
            if (sourceAppIdentifier && targetAppIdentifier && sourceAppIdentifier !== targetAppIdentifier) {
                const sourceAppNode = appNameMap[sourceAppIdentifier];
                const targetAppNode = appNameMap[targetAppIdentifier];
                
                if (!sourceAppNode || !targetAppNode) return;
                
                const sourceAppId = sourceAppNode.id;
                const targetAppId = targetAppNode.id;
                const connKey = `${sourceAppId}-${targetAppId}`;
                
                // Check if we already created this connection
                const existingConnection = appConnections.find(conn => 
                    conn.start_node === sourceAppId && conn.end_node === targetAppId);
                
                // Create connection if it doesn't exist yet
                if (!existingConnection) {
                    appConnections.push({
                        start_node: sourceAppId,
                        end_node: targetAppId,
                        type: edge.type,
                        connectedComponents: [{
                            start_node: edge.start_node,
                            end_node: edge.end_node
                        }]
                    });
                } else {
                    // Add this connection to the existing edge's data
                    existingConnection.connectedComponents.push({
                        start_node: edge.start_node,
                        end_node: edge.end_node
                    });
                }
            }
        });

        // Convert appNameMap to vertices object with ID as key, to match raw graph data structure
        const vertices = {};
        Object.values(appNameMap).forEach(appNode => {
            vertices[appNode.id] = appNode;
        });
        
        console.log(`NEO4J SERVICE: Aggregated data has ${Object.keys(vertices).length} application nodes and ${appConnections.length} connections`);
        
        return { 
            vertices, 
            edges: appConnections 
        };
    }

    /**
     * Process Neo4j properties to convert Neo4j types to JavaScript types
     * @param {Object} properties Neo4j properties object
     * @returns {Object} Processed properties
     */
    processProperties(properties) {
        const processed = {};

        for (const [key, value] of Object.entries(properties)) {
            // Handle Neo4j integers
            if (neo4j.isInt(value)) {
                processed[key] = value.toNumber();
            }
            // Handle arrays with Neo4j integers
            else if (Array.isArray(value)) {
                processed[key] = value.map(item =>
                    neo4j.isInt(item) ? item.toNumber() : item
                );
            }
            // Handle date objects - Neo4j returns them as native JavaScript Date objects
            else if (value instanceof Date) {
                processed[key] = value.toISOString();
            }
            // Pass through everything else
            else {
                processed[key] = value;
            }
        }

        return processed;
    }
}

// Create and export a singleton instance
export default new Neo4jService();