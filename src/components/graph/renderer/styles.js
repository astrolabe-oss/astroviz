/**
 * styles.js - Centralized styling configuration for GraphRenderer
 *
 * Contains all styling constants and configurations used across the graph visualization.
 * This module serves as a single source of truth for colors, highlights, and visual effects.
 */

/**
 * Centralized styling configuration
 */
export const STYLES = {
  // Node type base colors
  nodeColors: {
    'Application': '#F9696E',
    'Deployment': '#F2A3B3',
    'Compute': '#5DCAD1',
    'Resource': '#74B56D',
    'TrafficController': '#4A98E3',
    'Unknown': '#F9C96E'
  },

  // Highlight states styling
  highlights: {
    // Golden trace path
    path: {
      node: {
        scale: 1.2,
        color: '#FFA500',
        glowSize: '8px',
        glowColor: '#FFA500'
      },
      edge: {
        stroke: '#FFA500',
        strokeWidth: 5,
        opacity: 1,
        glow: 'drop-shadow(0 0 8px #FFA500)'
      }
    },
    // Head node (current selection)
    head: {
      scale: 1.2,
      color: '#8A4FBE',
      glowSize: '5px',
      glowColor: '#8A4FBE'
    },
    // Connected to head
    connected: {
      node: {
        scale: 1.1,
        color: '#A875D4',
        glowSize: '5px',
        glowColor: '#A875D4'
      },
      edge: {
        stroke: '#4444ff',
        strokeWidth: 3,
        opacity: 1
      }
    },
    // Dimmed (filtered out)
    dimmed: {
      opacity: 0.2
    }
  },

  // Unknown node special text styling
  unknownText: {
    highlighted: {
      fill: '#FFFFFF',
      fontWeight: 'bolder'
    },
    normal: {
      fill: '#333333',
      fontWeight: 'normal'
    }
  }
};