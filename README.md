# AstroViz
A powerful visualization tool for Astrolabe's Neo4j graph database, featuring hierarchical network visualization with custom SVG rendering and D3.js circle packing layout.

<img src="public/logo.svg?sanitize=true" alt="AstroViz Network Visualization" width="600">

## Features

- **Hierarchical Network Visualization**: Organized view showing Internet Boundary → Private Network → Clusters → Applications → Resources
- **Custom SVG Rendering**: High-performance custom renderer with D3.js circle packing for optimal layout
- **Direct Neo4j Connection**: Connect to any Neo4j database with proper credentials
- **Application Grouping**: Applications displayed as container groups that organize their resources
- **Advanced Filtering**: Filter by app_name, provider, protocol_multiplexor, address, and public IP status
- **Smart Highlighting**: 
    - Purple highlighting for nodes and their connections
    - Orange highlighting for application groups (with cross-cluster matching)
- **Public IP Annotations**: Cloud icon overlays on public-facing resources
- **Interactive Controls**: Zoom, pan, and group dragging capabilities
- **Node Details**: Click on any node or application group to see properties
- **Environment-based Configuration**: Easy setup for different environments

## Recent Improvements (v2.0)

- **Complete Rendering Engine Rewrite**: Replaced D3 force simulation with custom SVG renderer using circle packing
- **Unified View**: Removed dual-mode system in favor of single hierarchical view
- **Application-Centric Design**: Applications now shown as containers for their resources
- **Performance Boost**: Static layout calculation instead of continuous force simulation
- **Enhanced UX**: Cleaner interactions with separate highlighting systems for nodes vs applications
- **Visual Hierarchy**: Clear nesting with styled boundaries (dashed borders, opacity levels)

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

2. **Navigate the Hierarchy**:
    - View the network organized by Internet Boundary → Private Network → Clusters → Applications
    - Click on application groups to see application details
    - Shift-click to select multiple nodes or applications

3. **Filtering**:
    - Use the filter controls to narrow down the visualization
    - Filter by app name, provider, protocol multiplexer, or address
    - Reset filters to return to the full graph view

4. **Interaction**:
    - **Zoom**: Use mouse wheel or zoom buttons
    - **Pan**: Click and drag on the background
    - **Move Groups**: Click and drag groups to reposition
    - **Select Nodes**: Click to highlight node and connections (purple)
    - **Select Applications**: Click application groups for orange highlighting across clusters
    - **View Details**: Click on any node or application group to see properties
    - **Multi-Select**: Hold Shift while clicking to select multiple items

5. **Visual Elements**:
    - **Node Types**:
        - Deployment: Pink (#F2A3B3)
        - Compute: Light Blue (#5DCAD1)
        - Resource: Green (#74B56D)
        - TrafficController: Blue (#4A98E3)
    - **Group Boundaries**:
        - Internet Boundary: Blue dashed border with long-short pattern
        - Private Network: Gray dashed border
        - Clusters: Light blue background with blue border
        - Applications: Orange background with orange border
    - **Annotations**:
        - Public IP: Cloud icon overlay on public-facing nodes

## Architecture

The visualizer is built with:

- **Vue.js 2**: Frontend framework for reactive UI
- **D3.js**: Circle packing algorithm for hierarchical layout
- **Custom SVG Renderer**: High-performance rendering engine (`graphRenderer.js`)
- **Neo4j JavaScript Driver**: For direct database connection
- **ES6+**: Modern JavaScript features
- **Responsive Design**: Flexbox-based layout that adapts to viewport

The application follows a modular architecture:

- **App.vue**: Main application component and state management
- **D3NetworkGraph.vue**: Graph visualization orchestrator
- **GraphVisualization.vue**: Data transformation and renderer integration
- **graphRenderer.js**: Custom SVG rendering engine with circle packing
- **FilterControls.vue**: Advanced filtering interface
- **NodeDetails.vue**: Property viewer for nodes and applications
- **neo4jService.js**: Service for Neo4j database connections
- **config/index.js**: Environment-based configuration

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