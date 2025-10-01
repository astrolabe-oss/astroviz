/**
 * options.js - Centralized options configuration for GraphRenderer
 *
 * Contains all rendering options and configuration used across the graph visualization.
 * This module serves as a single source of truth for dimensions, sizes, and layout parameters.
 */

/**
 * Global graph options - initialized by GraphRenderer
 */
let OPTIONS = null;

/**
 * Initialize the global options
 * @param {Object} options - Options object from GraphRenderer
 */
export function initializeOptions(options) {
  OPTIONS = {
    width: options.width || 800,
    height: options.height || 600,
    nodeRadius: options.nodeRadius || 15,
    nodePadding: options.nodePadding || 5,
    groupPadding: options.groupPadding || 20,
    
    // Computed properties
    get centerX() { return this.width / 2; },
    get centerY() { return this.height / 2; },
    
    // Event handlers
    onNodeClick: options.onNodeClick || null,
    onGroupClick: options.onGroupClick || null
  };
}

/**
 * Get the current graph options
 * @returns {Object} Current graph options
 */
export function getOptions() {
  if (!OPTIONS) {
    throw new Error('Graph options not initialized. Call initializeOptions() first.');
  }
  return OPTIONS;
}
