/**
 * layoutUtils.js - Layout and positioning utilities for GraphRenderer
 *
 * Contains utilities for circle packing, canvas sizing, radial positioning,
 * and viewport fitting used in network graph visualization. Includes D3 pack
 * layout management and hybrid positioning systems.
 */

import * as d3 from 'd3';
import { getOptions } from './options.js';

export class LayoutUtils {
    /**
     * Build hierarchy structure and populate vertexMap from raw vertices data
     */
    static buildHierarchy(context, vertices) {
        // Take vertices as parameter - initialization data only
        if (!vertices) return null;

        console.log('Raw vertices data:', vertices);

        // Create vertex map with clean separation between app and database properties
        const vertexMap = new Map();

        Object.entries(vertices).forEach(([id, vertex]) => {
            // Use the already properly structured data from graphTransformUtils
            vertexMap.set(id, {
                // Application properties (for visualization/interaction)
                id: vertex.id || id,
                children: [],
                isGroup: vertex.type === 'group',
                isVirtual: vertex.isVirtual || false,
                parentId: vertex.parentId,
                label: vertex.label,
                style: vertex.style,
                x: 0, y: 0, r: 0,    // Will be set from D3 positioning

                // Database properties (clean for end users) - already separated
                data: vertex.data  // All vertices should have data from graphTransformUtils
            });
        });

        // Build parent-child relationships
        Object.entries(vertices).forEach(([id, vertex]) => {
            if (vertex.parentId && vertexMap.has(vertex.parentId)) {
                const parent = vertexMap.get(vertex.parentId);
                const child = vertexMap.get(id);
                parent.children.push(child);
            }
        });

        // Find roots (nodes with no parentId)
        const roots = [];
        vertexMap.forEach(vertex => {
            if (!vertex.parentId) {
                roots.push(vertex);
            }
        });

        // Simple approach: radial elements are root non-group elements
        const rootRadialElements = roots.filter(node => !node.isGroup);

        console.log(`Hierarchy separation: ${rootRadialElements.length} radial elements (excluding groups)`);

        // Store vertexMap in context
        context.state.vertexMap = vertexMap;

        // For circle packing, exclude radial elements - they'll be positioned radially
        const packedRoots = rootRadialElements.length > 0
            ? roots.filter(node => !rootRadialElements.includes(node))
            : roots;

        console.log(`Hierarchy for packing: ${packedRoots.length} roots (excluded ${roots.length - packedRoots.length} radial elements)`);

        // Create virtual root if needed, ensuring there is only one group-node at the root
        const hierarchy = packedRoots.length === 1 ? packedRoots[0] : {
            id: 'virtual-root',
            type: 'group',       // Use type instead of just isGroup
            children: packedRoots,
            isGroup: true,
            isVirtual: true
        };

        // Return hierarchy and elements that need radial positioning
        return { hierarchy, rootRadialElements };
    }

  /**
   * Calculate circle packing layout with optional radial positioning for root leaf nodes
   */
  static d3CirclePack(context, hierarchyRoot) {
    // Always do circle packing for the main hierarchy
    const root = d3.hierarchy(hierarchyRoot)
      .sum(d => {
        // Groups need a value for hierarchy, leaf nodes will use explicit radius
        return d.children && d.children.length > 0 ? 0 : 1;
      });

    const pack = d3.pack()
      .size([getOptions().width - 50, getOptions().height - 50])
      .padding(d => {
        // D3 padding function is called for PARENT nodes to set spacing between their CHILDREN
        // Check what type of children this parent has
        if (d.children && d.children.length > 0) {
          // Check if children are leaf nodes or groups
          const firstChild = d.children[0];
          const childrenAreLeafNodes = !firstChild.children || firstChild.children.length === 0;

          if (childrenAreLeafNodes) {
            // This parent's children are leaf nodes - use nodePadding
            return getOptions().nodePadding;
          } else {
            // This parent's children are groups - use groupPadding
            return getOptions().groupPadding;
          }
        }

        // Fallback (shouldn't happen since padding is only called for parents)
        return getOptions().nodePadding;
      })
      .radius(d => {
        // Set explicit radius for leaf nodes based on nodeRadius setting
        if (!d.children || d.children.length === 0) {
          return getOptions().nodeRadius;
        }
        // Let D3 calculate radius for group nodes (parents)
        return null;
      });

    return pack(root);
  }

  /**
   * Add radial positioning for root leaf nodes around the packed layout
   */
  static addRadialLayout(context, packedRoot, rootRadialElements) {
    console.log(`Adding radial layout: ${rootRadialElements.length} radial elements`);

    // Find the main container node (should be the only non-virtual root in packed hierarchy)
    const containerNodes = packedRoot.descendants().filter(d => d.depth === 1 && !d.data.isVirtual);
    
    if (containerNodes.length === 0) {
      console.error('No container node found for radial positioning');
      return packedRoot;
    }
    
    if (containerNodes.length > 1) {
      console.error(`Multiple container nodes found (${containerNodes.length}), radial positioning not supported yet`);
      return packedRoot;
    }

    const containerNode = containerNodes[0];
    const containerRadius = containerNode.r;

    // Center the container on the canvas
    const offsetX = getOptions().centerX - containerNode.x;
    const offsetY = getOptions().centerY - containerNode.y;

    // Apply offset to all nodes in the packed hierarchy
    packedRoot.descendants().forEach(node => {
      node.x += offsetX;
      node.y += offsetY;
    });

    // Position radial elements in a ring around the main container
    const ringRadius = containerRadius + 80; // 80px gap from container edge
    const radialNodes = [];

    if (rootRadialElements.length > 0) {
      const angleStep = (2 * Math.PI) / rootRadialElements.length;

      rootRadialElements.forEach((element, index) => {
        const angle = index * angleStep;
        const x = getOptions().centerX + Math.cos(angle) * ringRadius;
        const y = getOptions().centerY + Math.sin(angle) * ringRadius;

        // Create a packed node structure for consistency
        const radialNode = {
          data: element,
          x: x,
          y: y,
          r: element.isGroup ? 50 : getOptions().nodeRadius, // Groups get default radius, nodes use nodeRadius
          children: null,
          parent: packedRoot,
          depth: 1,
          height: 0
        };

        radialNodes.push(radialNode);
      });
    }

    // Add radial nodes to the packed hierarchy's descendants method
    const originalDescendants = packedRoot.descendants.bind(packedRoot);
    packedRoot.descendants = () => [...originalDescendants(), ...radialNodes];

    console.log(`Radial layout complete: added ${radialNodes.length} radial nodes around container (radius: ${containerRadius})`);

    return packedRoot;
  }

  /**
   * Fit the drawing to viewport on initial render
   * @param {Object} context - GraphRenderer context
   */
  static fitToView(context) {
    if (!context.state.vertexMap || !context.dom.svg || !context.dom.zoom) return;

    // Get the bounds of all visible elements using our vertex structure
    const allElements = Array.from(context.state.vertexMap.values()).filter(vertex => !vertex.isVirtual);
    if (allElements.length === 0) return;

    // Calculate bounding box of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    allElements.forEach(vertex => {
      const x = vertex.x;
      const y = vertex.y;
      const radius = vertex.isGroup ? vertex.r : getOptions().nodeRadius;

      minX = Math.min(minX, x - radius);
      minY = Math.min(minY, y - radius);
      maxX = Math.max(maxX, x + radius);
      maxY = Math.max(maxY, y + radius);
    });

    // Add some padding around the bounds
    const padding = 50;
    const contentWidth = maxX - minX + 2 * padding;
    const contentHeight = maxY - minY + 2 * padding;
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    // Calculate scale to fit content in viewport
    const viewportWidth = getOptions().width;
    const viewportHeight = getOptions().height;
    const scaleX = viewportWidth / contentWidth;
    const scaleY = viewportHeight / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1) * 1.25; // Zoom in 25% more than full fit for better readability

    // Calculate translation to center the content
    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;
    const translateX = viewportCenterX - contentCenterX * scale;
    const translateY = viewportCenterY - contentCenterY * scale;

    // Apply the transform immediately (no transition on initial render)
    const transform = d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale);

    context.dom.svg.call(context.dom.zoom.transform, transform);

    console.log(`Fit to view: scale=${scale.toFixed(2)}, translate=(${translateX.toFixed(0)}, ${translateY.toFixed(0)})`);
  }

  /**
   * Extract D3 positioning data back into our clean vertex structure
   */
  static extractPositionsFromD3(context, packedRoot) {
    packedRoot.descendants().forEach(d => {
      const vertex = context.state.vertexMap.get(d.data.id);
      if (vertex) {
        vertex.x = d.x + 25;  // Apply offset for margin
        vertex.y = d.y + 25;
        vertex.r = d.r;
      }
    });
  }
}