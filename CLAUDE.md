# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AstroViz is a Vue.js-based visualization tool for Astrolabe's Neo4j graph database. It provides an interactive force-directed graph visualization of network connections and applications.

## Essential Commands

```bash
# Development
npm run serve    # Start dev server on http://localhost:8080 (auto-opens browser)
npm run debug    # Start dev server in development mode

# Build
npm run build    # Build for production (output to dist/)

# Code Quality
npm run lint     # Run ESLint (currently disabled in vue.config.js)
```

## Architecture Overview

### Core Technologies
- **Vue 2.6.14** - Component framework
- **D3.js 7.8.5** - Force-directed graph visualization
- **neo4j-driver 5.6.0** - Database connectivity
- **Vuex 3.6.2** - State management

### Key Architectural Patterns

1. **Service Layer**: `src/services/neo4jService.js` handles all Neo4j database operations
2. **Component Structure**: 
   - `D3NetworkGraph.vue` - Main orchestrator component
   - `GraphVisualization.vue` - D3.js graph rendering
   - `NodeDetails.vue` - Node property display
   - `FilterControls.vue` - Graph filtering interface
3. **View Modes**: Supports "Detailed" (all nodes) and "Application" (aggregated) views
4. **Configuration**: Environment-based via `.env` files, managed in `src/config/index.js`

### Data Flow
1. Neo4j connection established via `neo4jService`
2. Graph data loaded with progress tracking
3. D3.js force simulation renders nodes and links
4. User interactions (zoom, pan, drag, click) update visualization
5. Filters highlight/fade nodes without removing them

### Key Features
- Multi-select nodes (shift-click)
- Connection retry on failure
- LocalStorage for view mode persistence
- Real-time graph updates during force simulation
- Clickable links/connections (recent feature)

## Development Guidelines

### Component Conventions
- Use Vue single-file components (.vue)
- Keep components focused on single responsibility
- Emit events up, pass props down
- Use descriptive prop names and proper prop validation

### State Management
- Component-local state for UI concerns
- Service layer for data fetching
- localStorage for user preferences

### Graph Visualization
- D3.js manages the force simulation and SVG rendering
- Vue manages the component lifecycle and data binding
- Keep D3 code isolated in GraphVisualization.vue
- Use `graphTransformUtils.js` for coordinate transformations

### Neo4j Queries
- All queries centralized in `neo4jService.js`
- Use parameterized queries for security
- Handle connection errors gracefully with retry logic

## Common Tasks

### Adding a New Filter
1. Update `FilterControls.vue` to add UI control
2. Modify `neo4jService.js` queries if needed
3. Update filtering logic in `D3NetworkGraph.vue`

### Modifying Graph Behavior
1. Graph rendering logic is in `GraphVisualization.vue`
2. Force simulation parameters in `initializeSimulation()`
3. Node/link styling in respective update functions

### Adding Node Properties
1. Update `NodeDetails.vue` to display new properties
2. Ensure properties are included in Neo4j queries
3. Consider adding to multi-select comparison view

## Environment Configuration

Required `.env` variables:
- `VUE_APP_NEO4J_URL` - Neo4j connection URL
- `VUE_APP_NEO4J_USERNAME` - Neo4j username
- `VUE_APP_NEO4J_PASSWORD` - Neo4j password