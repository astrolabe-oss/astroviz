/**
 * layoutUtils.js - Layout and positioning utilities for GraphRenderer
 *
 * Contains utilities for circle packing, canvas sizing, radial positioning,
 * and viewport fitting used in network graph visualization. Includes D3 pack
 * layout management and hybrid positioning systems.
 */

import * as d3 from 'd3';

export class LayoutUtils {
  /**
   * Calculate optimal canvas size based on graph complexity
   */
  static calculateOptimalCanvasSize(renderer, hierarchyRoot) {
    // Count nodes at each level
    let leafNodes = 0;
    let groupNodes = 0;
    let maxDepth = 0;
    let maxChildrenAtAnyLevel = 0;

    // Traverse hierarchy to gather statistics
    const traverse = (node, depth = 0) => {
      maxDepth = Math.max(maxDepth, depth);

      if (!node.children || node.children.length === 0) {
        leafNodes++;
      } else {
        groupNodes++;
        maxChildrenAtAnyLevel = Math.max(maxChildrenAtAnyLevel, node.children.length);
        node.children.forEach(child => traverse(child, depth + 1));
      }
    };

    traverse(hierarchyRoot);

    console.log(`Graph stats: ${leafNodes} leaves, ${groupNodes} groups, depth ${maxDepth}, max children ${maxChildrenAtAnyLevel}`);

    // Calculate scale factors based on complexity (very conservative)
    // More leaves need more space
    const leafFactor = Math.log10(leafNodes + 1) * 0.1;  // Use log for gentler scaling

    // Deeper hierarchies need more space for nested circles
    const depthFactor = maxDepth * 0.05;  // Very small increment per level

    // More groups need more space for labels and padding
    const groupFactor = Math.log10(groupNodes + 1) * 0.1;  // Use log for gentler scaling

    // Padding contributes to scale
    const paddingFactor = renderer.options.nodePadding / 200;  // Much smaller contribution

    // Calculate final scale (minimum 1x, typically 1.1-1.5x for complex graphs)
    const scale = Math.max(1, 1 + leafFactor + depthFactor + groupFactor + paddingFactor);

    const canvasWidth = renderer.options.width * scale;
    const canvasHeight = renderer.options.height * scale;

    console.log(`Canvas scaling: leaf(${leafFactor.toFixed(2)}) + depth(${depthFactor.toFixed(2)}) + group(${groupFactor.toFixed(2)}) + padding(${paddingFactor.toFixed(2)}) = ${scale.toFixed(2)}x`);
    console.log(`Final canvas: ${canvasWidth.toFixed(0)}x${canvasHeight.toFixed(0)}`);

    return { width: canvasWidth, height: canvasHeight, scale };
  }

  /**
   * Calculate circle packing layout with optional radial positioning for root leaf nodes
   */
  static calculatePack(renderer, hierarchyRoot) {
    // Calculate optimal canvas size based on graph complexity
    const { width, height } = LayoutUtils.calculateOptimalCanvasSize(renderer, hierarchyRoot);
    const centerX = width / 2;
    const centerY = height / 2;

    // Always do circle packing for the main hierarchy
    const root = d3.hierarchy(hierarchyRoot)
      .sum(d => {
        // Groups need a value for hierarchy, leaf nodes will use explicit radius
        return d.children && d.children.length > 0 ? 0 : 1;
      });

    const pack = d3.pack()
      .size([width - 50, height - 50])
      .padding(d => {
        // D3 padding function is called for PARENT nodes to set spacing between their CHILDREN
        // Check what type of children this parent has
        if (d.children && d.children.length > 0) {
          // Check if children are leaf nodes or groups
          const firstChild = d.children[0];
          const childrenAreLeafNodes = !firstChild.children || firstChild.children.length === 0;

          if (childrenAreLeafNodes) {
            // This parent's children are leaf nodes - use nodePadding
            return renderer.options.nodePadding;
          } else {
            // This parent's children are groups - use groupPadding
            return renderer.options.groupPadding;
          }
        }

        // Fallback (shouldn't happen since padding is only called for parents)
        return renderer.options.nodePadding;
      })
      .radius(d => {
        // Set explicit radius for leaf nodes based on nodeRadius setting
        if (!d.children || d.children.length === 0) {
          return renderer.options.nodeRadius;
        }
        // Let D3 calculate radius for group nodes (parents)
        return null;
      });

    const packedRoot = pack(root);

    // If we have root leaf nodes to position radially, handle them specially
    if (renderer.hybridLayout && renderer.hybridLayout.rootLeafNodes.length > 0) {
      return LayoutUtils.addRadialLayout(renderer, packedRoot, centerX, centerY);
    }

    return packedRoot;
  }

  /**
   * Add radial positioning for root leaf nodes around the packed layout
   */
  static addRadialLayout(renderer, packedRoot, centerX, centerY) {
    const { rootLeafNodes, otherRootGroups } = renderer.hybridLayout;

    console.log(`Adding radial layout: ${rootLeafNodes.length} root leaves, ${otherRootGroups.length} other groups`);

    // Find the internet-boundary node in the packed hierarchy
    const internetBoundaryNode = packedRoot.descendants().find(d => d.data.id === 'internet-boundary');
    let internetBoundaryRadius = 0;

    if (internetBoundaryNode) {
      internetBoundaryRadius = internetBoundaryNode.r;

      // Center the internet boundary on the canvas
      const offsetX = centerX - internetBoundaryNode.x;
      const offsetY = centerY - internetBoundaryNode.y;

      // Apply offset to all nodes in the packed hierarchy
      packedRoot.descendants().forEach(node => {
        node.x += offsetX;
        node.y += offsetY;
      });
    }

    // Position root leaf nodes in a ring around the private network
    const ringRadius = internetBoundaryRadius + 80; // 80px gap from internet boundary edge
    const radialNodes = [];

    if (rootLeafNodes.length > 0) {
      const angleStep = (2 * Math.PI) / rootLeafNodes.length;

      rootLeafNodes.forEach((leafNode, index) => {
        const angle = index * angleStep;
        const x = centerX + Math.cos(angle) * ringRadius;
        const y = centerY + Math.sin(angle) * ringRadius;

        // Create a packed node structure for consistency
        const radialNode = {
          data: leafNode,
          x: x,
          y: y,
          r: renderer.options.nodeRadius, // Use consistent radius (no fallback)
          children: null,
          parent: packedRoot,
          depth: 1,
          height: 0
        };

        radialNodes.push(radialNode);
      });
    }

    // Handle other root groups (if any) - position them further out
    if (otherRootGroups.length > 0) {
      const outerRingRadius = ringRadius + 100;
      const outerAngleStep = (2 * Math.PI) / otherRootGroups.length;

      otherRootGroups.forEach((group, index) => {
        const angle = index * outerAngleStep;
        const x = centerX + Math.cos(angle) * outerRingRadius;
        const y = centerY + Math.sin(angle) * outerRingRadius;

        const radialGroup = {
          data: group,
          x: x,
          y: y,
          r: 50, // Default group radius
          children: null,
          parent: packedRoot,
          depth: 1,
          height: 0
        };

        radialNodes.push(radialGroup);
      });
    }

    // Add radial nodes to the packed hierarchy's descendants method
    const originalDescendants = packedRoot.descendants.bind(packedRoot);
    packedRoot.descendants = () => [...originalDescendants(), ...radialNodes];

    console.log(`Radial layout complete: added ${radialNodes.length} radial nodes to packed hierarchy`);

    return packedRoot;
  }

  /**
   * Fit the drawing to viewport on initial render
   * @param {Object} context - GraphRenderer context
   * @param {Object} packedRoot - D3 packed hierarchy root
   */
  static fitToView(context, packedRoot) {
    if (!packedRoot || !context.state.vertexMap || !context.options || !context.interaction.svg || !context.interaction.zoom) return;

    // Get the bounds of all visible elements using our vertex structure
    const allElements = Array.from(context.state.vertexMap.values()).filter(vertex => !vertex.isVirtual);
    if (allElements.length === 0) return;

    // Calculate bounding box of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    allElements.forEach(vertex => {
      const x = vertex.x;
      const y = vertex.y;
      const radius = vertex.isGroup ? vertex.r : context.options.nodeRadius;

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
    const viewportWidth = context.options.width;
    const viewportHeight = context.options.height;
    const scaleX = viewportWidth / contentWidth;
    const scaleY = viewportHeight / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1) * 1.33; // Zoom in 33% more than full fit for better readability

    // Calculate translation to center the content
    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;
    const translateX = viewportCenterX - contentCenterX * scale;
    const translateY = viewportCenterY - contentCenterY * scale;

    // Apply the transform immediately (no transition on initial render)
    const transform = d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale);

    context.interaction.svg.call(context.interaction.zoom.transform, transform);

    console.log(`Fit to view: scale=${scale.toFixed(2)}, translate=(${translateX.toFixed(0)}, ${translateY.toFixed(0)})`);
  }
}