// src/config/index.js
/**
 * Application configuration
 * Loads values from environment variables with fallbacks
 */

const neo4jConfig = {
    protocol: process.env.VUE_APP_NEO4J_PROTOCOL || 'bolt',
    host: process.env.VUE_APP_NEO4J_HOST || 'localhost',
    port: process.env.VUE_APP_NEO4J_PORT || 7687,
    username: process.env.VUE_APP_NEO4J_USERNAME || 'neo4j',
    password: process.env.VUE_APP_NEO4J_PASSWORD || 'neo4j',
    database: process.env.VUE_APP_NEO4J_DATABASE || '',

    // Computed connection URI
    get uri() {
        return `${this.protocol}://${this.host}:${this.port}`;
    }
};

// Log configuration on startup (without password)
console.log('CONFIG: Loaded configuration', {
    protocol: neo4jConfig.protocol,
    host: neo4jConfig.host,
    port: neo4jConfig.port,
    username: neo4jConfig.username,
    database: neo4jConfig.database,
    uri: neo4jConfig.uri
});

export default {
    neo4j: neo4jConfig
};