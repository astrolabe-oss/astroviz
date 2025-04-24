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
        const driverConfig = {};
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

        let session;
        try {
            console.log("NEO4J SERVICE: Getting session...");
            session = this.getSession();

            // Count total nodes and relationships to track progress
            reportProgress("Counting nodes and relationships...", 15);

            console.log("NEO4J SERVICE: Running count query...");
            const countResult = await session.run(`
        MATCH (n) 
        RETURN count(n) AS nodeCount
      `);

            const nodeCount = countResult.records[0].get('nodeCount').toNumber();
            console.log(`NEO4J SERVICE: Found ${nodeCount} nodes`);
            reportProgress(`Found ${nodeCount} nodes`, 20);

            // Get all nodes and their properties
            reportProgress("Fetching node data...", 25);
            console.log("NEO4J SERVICE: Running nodes query...");
            const nodesResult = await session.run(`
        MATCH (n)
        RETURN n, labels(n) as labels
      `);

            console.log(`NEO4J SERVICE: Retrieved ${nodesResult.records.length} node records`);
            reportProgress("Processing node data...", 40);

            // Process nodes
            console.log("NEO4J SERVICE: Processing node data...");
            const vertices = {};
            nodesResult.records.forEach((record, index) => {
                if (index % 50 === 0 && nodeCount > 100) {
                    // Periodically update progress for large datasets
                    const progressPercent = 40 + Math.floor((index / nodesResult.records.length) * 15);
                    reportProgress(`Processed ${index} of ${nodesResult.records.length} nodes...`, progressPercent);
                }

                const node = record.get('n');
                const labels = record.get('labels');
                const id = node.identity.toString();

                vertices[id] = {
                    ...node.properties,
                    type: labels[0]  // Use first label as type
                };
            });

            // Get all relationships
            reportProgress("Fetching relationship data...", 55);
            console.log("NEO4J SERVICE: Running relationships query...");
            const relsResult = await session.run(`
        MATCH (parent)-[r]->(child)
        RETURN ID(parent) as parent_id, ID(child) as child_id, type(r) as rel_type, properties(r) as props
      `);

            console.log(`NEO4J SERVICE: Retrieved ${relsResult.records.length} relationship records`);
            reportProgress("Processing relationship data...", 60);

            // Process relationships
            console.log("NEO4J SERVICE: Processing relationship data...");
            const edges = [];
            relsResult.records.forEach((record, index) => {
                if (index % 50 === 0 && relsResult.records.length > 100) {
                    // Periodically update progress for large datasets
                    const progressPercent = 60 + Math.floor((index / relsResult.records.length) * 10);
                    reportProgress(`Processed ${index} of ${relsResult.records.length} relationships...`, progressPercent);
                }

                edges.push({
                    start_node: record.get('parent_id').toString(),
                    end_node: record.get('child_id').toString(),
                    type: record.get('rel_type'),
                    properties: record.get('props')
                });
            });

            console.log(`NEO4J SERVICE: Completed with ${Object.keys(vertices).length} vertices and ${edges.length} edges`);
            return { vertices, edges };
        } catch (error) {
            console.error("NEO4J SERVICE: Error in fetchGraphData", error);
            throw error;
        } finally {
            if (session) {
                console.log("NEO4J SERVICE: Closing session");
                await session.close();
            }
        }
    }
}

// Create and export a singleton instance
export default new Neo4jService();