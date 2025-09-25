/**
 * layoutHelpers.js - Shared layout calculation utilities
 *
 * Contains utility functions shared across multiple renderer components
 * for consistent layout calculations and positioning.
 */

export class GroupUtils {
  /**
   * Calculate collapsed radius with smart sizing logic
   * @param {number} originalRadius - Original group radius
   * @param {number} nodeRadius - Node radius from options for reference
   * @param {number} childCount - Number of child nodes in the group
   * @returns {number} Collapsed radius with appropriate sizing applied
   */
  static getCollapsedRadius(originalRadius, nodeRadius, childCount = null) {
    // For single-node groups, don't resize at all - just return original size
    if (childCount === 1) {
      return originalRadius;
    }
    
    // For multi-node groups, apply 40% shrinking with intelligent minimums
    const shrunkRadius = originalRadius * 0.4;
    
    // Use smart minimums: either 1.2x node radius OR 70% of original radius
    const nodeBasedMinimum = nodeRadius * 1.2;
    const originalBasedMinimum = originalRadius * 0.7;
    const minimumRadius = Math.max(nodeBasedMinimum, originalBasedMinimum);
    
    // Return the larger of shrunk size or minimum
    return Math.max(shrunkRadius, minimumRadius);
  }
}