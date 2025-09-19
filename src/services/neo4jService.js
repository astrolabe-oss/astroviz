/**
 * Copyright 2025 Lightwire, LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// src/services/neo4jService.js
import neo4j from 'neo4j-driver';
import config from '@/config';
import meetingAttendees from '@/data/meetingAttendees.json';

/**
 * Service to handle Neo4j database connection and queries
 */
class Neo4jService {
    constructor() {
        this.driver = null;
        this.isDemo = this.detectDemoMode();
    }

    /**
     * Detect if we should use demo mode based on environment variables
     */
    detectDemoMode() {
        const hasNeo4jUrl = !!(process.env.VUE_APP_NEO4J_URL || process.env.VUE_APP_NEO4J_HOST);
        const hasCredentials = !!(process.env.VUE_APP_NEO4J_USERNAME && process.env.VUE_APP_NEO4J_PASSWORD);
        
        const hasNeo4jConfig = hasNeo4jUrl && hasCredentials;
        
        console.log('NEO4J SERVICE: Environment detection:', {
            hasNeo4jUrl,
            hasCredentials,
            hasNeo4jConfig,
            willUseDemoMode: !hasNeo4jConfig
        });
        
        return !hasNeo4jConfig;
    }

    /**
     * Check if we're running in demo mode
     */
    isDemoMode() {
        return this.isDemo;
    }

    /**
     * Connect to Neo4j database or simulate connection in demo mode
     * @returns {Promise} Promise that resolves when connection is successful
     */
    connect() {
        if (this.isDemo) {
            console.log('NEO4J SERVICE: Demo mode - simulating connection');
            return Promise.resolve();
        }
        
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
     * Close the Neo4j connection or simulate disconnection in demo mode
     */
    disconnect() {
        if (this.isDemo) {
            console.log('NEO4J SERVICE: Demo mode - simulating disconnection');
            return;
        }
        
        if (this.driver) {
            this.driver.close();
            this.driver = null;
        }
    }

    /**
     * Check if connected to Neo4j or in demo mode
     * @returns {boolean} Connection status
     */
    isConnected() {
        if (this.isDemo) {
            return true; // Always connected in demo mode
        }
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
     * Fetch the entire graph data from Neo4j or return mock data in demo mode
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
            let result;
            
            if (this.isDemo) {
                // Use mock data instead of querying Neo4j
                reportProgress("Loading mock graph data...", 30);
                result = {
                    records: [{
                        get: (field) => {
                            if (field === 'nodes') return meetingAttendees[0].nodes;
                            if (field === 'relationships') return meetingAttendees[0].links;
                            return null;
                        }
                    }]
                };
            } else {
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
                result = await this.runQuery(query);
            }

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