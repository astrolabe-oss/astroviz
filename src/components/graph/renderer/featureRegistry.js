/**
 * featureRegistry.js - Central registry for graph rendering features
 *
 * Provides a plugin architecture for features like filtering and highlighting.
 * Features register themselves and their styling capabilities with the registry,
 * which coordinates rendering and post-render effects.
 */

import { NodeUtils } from './nodeUtils.js';
import { EdgeUtils } from './edgeUtils.js';
import { GroupUtils } from './groupUtils.js';

export class FeatureRegistry {
  // Array of registered features
  static features = [];

  // Graph context (set during initialization)
  static context = null;

  /**
   * Initialize the registry with the graph context
   * @param {Object} context - GraphRenderer context
   */
  static initialize(context) {
    this.context = context;
    this.features = []; // Reset features on re-initialization
  }

  /**
   * Register a feature with the registry
   * @param {Object} feature - Feature class with nodePostRenderHook/edgePostRenderHook methods
   */
  static register(feature) {
    if (!this.features.includes(feature)) {
      this.features.push(feature);

      // Call the feature's register method if it has one (for initialization)
      if (feature.register) {
        feature.register();
      }
    }
  }

  /**
   * Apply all registered features' node styles
   * Called by NodeUtils.styleAll for each node
   * @param {d3.Selection} node - D3 selection of the node element
   * @param {string} nodeId - Node ID
   * @param {Object} context - Rendering context
   */
  static nodePostRenderHooks(node, nodeId, context) {
    for (const feature of this.features) {
      if (feature.nodePostRenderHook) {
        feature.nodePostRenderHook(node, nodeId, context);
      }
    }
  }

  /**
   * Apply all registered features' edge styles
   * Called by EdgeUtils.styleAll for each edge
   * @param {d3.Selection} edge - D3 selection of the edge element
   * @param {string} source - Source node ID
   * @param {string} target - Target node ID
   * @param {Object} context - Rendering context
   */
  static edgePostRenderHooks(edge, source, target, context) {
    for (const feature of this.features) {
      if (feature.edgePostRenderHook) {
        feature.edgePostRenderHook(edge, source, target, context);
      }
    }
  }

  /**
   * Apply all registered features' group styles (both circle and label)
   * Called by GroupUtils.renderGroupsWithHooks for each group
   * @param {d3.Selection} circle - D3 selection of the group circle element
   * @param {d3.Selection} labelContainer - D3 selection of the label container (or null if no label)
   * @param {string} groupId - Group ID
   * @param {Object} context - Rendering context
   */
  static groupPostRenderHooks(circle, labelContainer, groupId, context) {
    for (const feature of this.features) {
      if (feature.groupPostRenderHook) {
        feature.groupPostRenderHook(circle, labelContainer, groupId, context);
      }
    }
  }

  /**
   * Trigger a full re-render of the graph
   * @param {Function} postRenderCallback - Optional callback to run after rendering
   */
  static triggerRender(postRenderCallback = null) {
    if (!this.context) {
      console.warn('FeatureRegistry: Cannot trigger render - context not initialized');
      return;
    }

    // Re-render all elements in z-index order
    GroupUtils.renderGroupsWithHooks(this.context);  // Lowest z-index
    EdgeUtils.renderEdgesWithHooks(this.context);
    NodeUtils.renderNodesWithHooks(this.context);   // Highest z-index

    // Run post-render callback if provided
    if (postRenderCallback) {
      postRenderCallback();
    }
  }
}