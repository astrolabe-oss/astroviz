# Changelog

All notable changes to AstroViz will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2025-09-11

### Demo Mode
- Automatic environment detection - switches to demo mode when Neo4j environment variables are not configured
- Demo mode banner with visual indicator when using mock data
- Direct support for exported Neo4j data as static JSON for demos

### GitHub Pages Deployment
- Automated deployment pipeline with GitHub Actions
- Builds and deploys automatically on push to main branch
- Optimized build configuration for static hosting

### Interactive Tutorial System
- Step-by-step walkthrough of all major features using driver.js
- Auto-starts in demo mode (every refresh) and for first-time production users

---

## [0.2.0] - 2025-01-11

### Major Changes - Complete Rendering Engine Rewrite
- **Complete rendering engine rewrite**: Replaced D3.js force-directed graph with custom SVG renderer using D3 circle packing
- **Hierarchical network visualization**: Added Internet Boundary → Private Network → Clusters → Applications → Resources hierarchy
- **Application-centric design**: Applications now rendered as container groups that organize their resources instead of individual nodes
- **Performance improvements**: Static layout calculation replaces continuous force simulation for better performance
- **Unified view system**: Removed dual-mode (detailed/application) system in favor of single hierarchical view

### New Features
- **Public IP annotations**: Cloud icon overlays on nodes with public IP addresses
- **Smart highlighting system**: 
  - Purple highlighting for individual nodes and their connections
  - Orange highlighting for application groups with cross-cluster matching
- **Enhanced interactions**: 
  - Click application groups to view application details
  - Shift-click for multi-select support
  - Drag groups to reposition
- **Visual hierarchy**: Clear nesting with styled boundaries (dashed borders, color coding, opacity levels)
- **Edge filtering**: Automatically filters edges involving application nodes for cleaner visualization

### Technical Improvements
- **Refactored architecture**: Clean separation of concerns with unified click handling system
- **Data transformation utilities**: Moved graph transformation logic to `graphTransformUtils.js`
- **Unified styling system**: Centralized style API with supported styles map
- **Component cleanup**: Renamed `D3NetworkGraph.vue` to `NetworkGraph.vue` for accuracy
- **Responsive design**: Improved flexbox-based layout that adapts to viewport

### Removed
- **Application view mode**: Dual-mode system removed in favor of hierarchical containers
- **View mode selector**: No longer needed with unified view
- **Force simulation**: Replaced with static circle packing layout
- **Continuous animations**: Static positioning for better performance

### Breaking Changes
- Removed `ViewModeSelector` component
- Changed graph data transformation architecture
- Updated component names and file structure
- Modified event handling system

---

## [0.1.0] - 2024-12-XX

### Initial Release
- **D3.js force-directed graph**: Interactive network visualization with force simulation
- **Dual view modes**:
  - Detailed view showing all nodes and relationships
  - Application view with aggregated connections
- **Neo4j integration**: Direct connection to Neo4j database with real-time data loading
- **Interactive controls**: Zoom, pan, and node dragging capabilities
- **Advanced filtering**: Filter by app_name, provider, protocol_multiplexor, and address
- **Node details panel**: Click on nodes to view all properties
- **Multi-select support**: Shift-click to select multiple nodes
- **Connection management**: Retry logic and error handling for database connections
- **Environment configuration**: Easy setup with `.env` files
- **Responsive design**: Works on desktop and tablet devices

### Core Components
- Vue.js 2.6.14 frontend framework
- D3.js force simulation for graph layout
- Neo4j JavaScript driver for database connectivity
- Modular component architecture

### Node Types Support
- Application nodes (green)
- Deployment nodes (blue) 
- Compute nodes (orange)
- Resource nodes (purple)
- TrafficController nodes (teal)
- InternetIP nodes (pink)