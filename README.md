# Astrolabe Network Visualizer

A lightweight visualization tool for Astrolabe's Neo4j graph database. This tool provides both detailed and application-level views of service connections with filtering capabilities.

## Features

- Direct connection to Neo4j database
- Detailed view showing all nodes and relationships
- Application-level view that rolls up compute-level connections
- Filtering by app_name, provider, protocol_multiplexor, and more
- Node details inspection
- Environment-based configuration

## Configuration

Connection settings are loaded from environment variables. Create a `.env` file in the project root with the following variables:

```
VUE_APP_NEO4J_PROTOCOL=bolt
VUE_APP_NEO4J_HOST=localhost
VUE_APP_NEO4J_PORT=7687
VUE_APP_NEO4J_USERNAME=neo4j
VUE_APP_NEO4J_PASSWORD=your_password
VUE_APP_NEO4J_DATABASE=
```

## Project setup

```
npm install
```

### Compiles and hot-reloads for development

```
npm run serve
```

### Compiles and minifies for production

```
npm run build
```

### Lints and fixes files

```
npm run lint
```

## Usage

1. Start your local Neo4j database
2. Run the application with `npm run serve`
3. Click "Connect to Neo4j" to connect to the database
4. Use filters to narrow down the view
5. Toggle between "Detailed View" and "Application View" to change visualization level
6. Click on nodes to view detailed properties

## Dependencies

- Vue.js 2.6
- vis-network for graph visualization
- neo4j-driver for database connection