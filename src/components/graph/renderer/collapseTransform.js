/**
 * collapseTransform.js - Transform raw graph data for collapsed groups
 *
 * Converts collapsed groups into nodes and redirects edges appropriately.
 */

/**
 * Apply collapse transformation to raw graph data
 * @param {Map} rawVertexMap - Original vertex map
 * @param {Array} rawEdges - Original edges
 * @param {Set} collapsedGroups - Set of collapsed group IDs
 * @returns {Object} Transformed { vertexMap, edges }
 */
export function applyCollapseTransform(rawVertexMap, rawEdges, collapsedGroups) {
  const transformedVertexMap = new Map();
  const hiddenVertexIds = new Set();

  // Phase 1: Identify hidden vertices (descendants of collapsed groups)
  collapsedGroups.forEach(groupId => {
    rawVertexMap.forEach((vertex, vertexId) => {
      if (vertexId === groupId) return; // Don't hide the group itself

      // Walk up parent chain to see if this vertex is a descendant
      let current = vertex;
      let depth = 0;
      while (current?.parentId && depth < 10) {
        if (current.parentId === groupId) {
          hiddenVertexIds.add(vertexId);
          break;
        }
        current = rawVertexMap.get(current.parentId);
        depth++;
      }
    });
  });

  // Phase 2: Transform vertices
  rawVertexMap.forEach((vertex, vertexId) => {
    // Skip hidden descendants
    if (hiddenVertexIds.has(vertexId)) {
      return;
    }

    // Transform collapsed groups to Application nodes (rendered as circles)
    if (collapsedGroups.has(vertexId)) {
      transformedVertexMap.set(vertexId, {
        ...vertex,                // Keep everything including children
        isGroup: true,            // Preserve structural truth - it IS still a group
        isVirtual: false,
        isCollapsed: true,        // Flag for rendering as node instead of group
        r: 30,                    // Set fixed radius for collapsed circle
        data: {
          ...vertex.data,
          type: 'Application'     // Type for identification
        }
      });
    } else {
      // Keep all other visible vertices as-is
      transformedVertexMap.set(vertexId, { ...vertex });
    }
  });

  // Phase 3: Transform edges - redirect from hidden vertices to their visible ancestor
  const transformedEdges = [];

  rawEdges.forEach(edge => {
    const visibleSource = findVisibleAncestor(edge.source, rawVertexMap, hiddenVertexIds, collapsedGroups);
    const visibleTarget = findVisibleAncestor(edge.target, rawVertexMap, hiddenVertexIds, collapsedGroups);

    // Skip self-edges (internal to collapsed group)
    if (visibleSource === visibleTarget) return;

    transformedEdges.push({
      ...edge,
      source: visibleSource,
      target: visibleTarget
    });
  });

  return {
    vertexMap: transformedVertexMap,
    edges: transformedEdges
  };
}

/**
 * Find the visible ancestor of a vertex (handles hidden descendants)
 * @param {string} vertexId - Vertex ID to check
 * @param {Map} rawVertexMap - Original vertex map
 * @param {Set} hiddenVertexIds - Set of hidden vertex IDs
 * @param {Set} collapsedGroups - Set of collapsed group IDs
 * @returns {string} ID of visible ancestor (or original if already visible)
 */
function findVisibleAncestor(vertexId, rawVertexMap, hiddenVertexIds, collapsedGroups) {
  // If not hidden, return as-is
  if (!hiddenVertexIds.has(vertexId)) {
    return vertexId;
  }

  // Walk up parent chain to find visible ancestor
  let current = rawVertexMap.get(vertexId);
  let depth = 0;

  while (current?.parentId && depth < 10) {
    // Check if parent is a collapsed group (visible ancestor)
    if (collapsedGroups.has(current.parentId)) {
      return current.parentId;
    }

    // Check if parent is visible
    if (!hiddenVertexIds.has(current.parentId)) {
      return current.parentId;
    }

    current = rawVertexMap.get(current.parentId);
    depth++;
  }

  // Fallback to original ID if we couldn't find ancestor
  return vertexId;
}
