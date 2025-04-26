# Special and Fun Astrolabe Visualizer
A powerful visualization tool for Astrolabe's Neo4j graph database, leveraging D3.js force-directed graph layout for improved performance and flexibility.

<img src="./logo.svg?sanitize=true" alt="Astroviz Network Visualization" width="600">

## Features

- **D3.js Visualization**: Using D3's force simulation for smooth, interactive graph rendering
- **Direct Neo4j Connection**: Connect to any Neo4j database with proper credentials
- **Multiple View Modes**:
    - Detailed view showing all nodes and relationships
    - Application-level view that rolls up compute-level connections
- **Advanced Filtering**: Filter by app_name, provider, protocol_multiplexor, and address
- **Interactive Controls**: Zoom, pan, and node dragging capabilities
- **Node Details**: Click on nodes to see all properties
- **Environment-based Configuration**: Easy setup for different environments

## Advantages Over Previous Visualizer

- **Improved Performance**: D3's optimized force layout handles larger graphs more efficiently
- **Better User Interaction**: More intuitive dragging, zooming, and panning
- **Enhanced Visual Appeal**: Smoother animations and transitions
- **Greater Customization**: More control over the visual representation of nodes and edges
- **Responsive Design**: Better handling of different screen sizes

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

## Project Setup

### Prerequisites

- Node.js (v14+)
- NPM or Yarn
- Neo4j database (v4.0+)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd astrolabe-d3-visualizer

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your Neo4j credentials
```

### Development

```bash
# Start the development server with hot-reload
npm run serve
```

### Production Build

```bash
# Compile and minify for production
npm run build
```

## Usage Guide

1. **Connect to Database**:
    - Start your Neo4j database
    - Launch the application
    - Click "Connect to Neo4j" to establish connection

2. **View Modes**:
    - **Detailed View**: Shows all nodes and relationships in the database
    - **Application View**: Consolidates nodes to show application-level connections

3. **Filtering**:
    - Use the filter controls to narrow down the visualization
    - Filter by app name, provider, protocol multiplexer, or address
    - Reset filters to return to the full graph view

4. **Interaction**:
    - **Zoom**: Use mouse wheel or zoom buttons
    - **Pan**: Click and drag on the background
    - **Move Nodes**: Click and drag individual nodes
    - **View Details**: Click on any node to see its properties

5. **Node Types and Colors**:
    - Application: Green
    - Deployment: Blue
    - Compute: Orange
    - Resource: Purple
    - TrafficController: Teal
    - InternetIP: Pink

## Architecture

The visualizer is built with:

- **Vue.js 2**: Frontend framework for reactive UI
- **D3.js**: For advanced graph visualization and force layout
- **Neo4j JavaScript Driver**: For direct database connection
- **ES6+**: Modern JavaScript features
- **Responsive Design**: Works on desktop and tablets

The application follows a modular architecture:

- **App.vue**: Main application component
- **D3NetworkGraph.vue**: D3 force-directed graph visualization
- **FilterBar.vue**: Filter controls for the graph data
- **neo4jService.js**: Service for Neo4j database connections
- **config/index.js**: Configuration management

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

SPDX-License-Identifier: Apache-2.0

## Acknowledgments

- The Astrolabe team for the original database schema
- Neo4j team for their excellent graph database
- D3.js community for the powerful visualization library