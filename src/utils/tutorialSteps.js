/**
 * Copyright 2025 Lightwire, LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Tutorial steps configuration for AstroViz
export const tutorialSteps = [
  {
    element: null, // No element - show as modal
    popover: {
      title: 'Welcome to AstroViz! 🚀',
      description: 'Let\'s take a quick tour to explore the network visualization features. You can skip this at any time.',
      position: 'center'
    }
  },
  {
    element: '.filter-container',
    popover: {
      title: 'Highlight Controls',
      description: 'Use these dropdowns to highlight specific nodes by app name, provider, protocol, or address.',
      position: 'bottom'
    }
  },
  {
    element: '.filter-container .reset-button',
    popover: {
      title: 'Reset Filters',
      description: 'Try clicking the "Reset Filters" button to clear all active filters and return to the full view.',
      position: 'bottom'
    }
  },
  {
    element: '.controls',
    popover: {
      title: 'Zoom Controls',
      description: 'Try these zoom controls! Use + to zoom in, - to zoom out, or the reset button to fit the view.',
      position: 'left'
    }
  },
  {
    element: '#graph-container',
    popover: {
      title: 'Network Visualization',
      description: 'This is your network graph. Drag to pan, scroll to zoom, and click nodes to explore.',
      position: 'center'
    }
  },
  {
    element: '#graph-svg .nodes',
    popover: {
      title: 'Interact with Nodes',
      description: 'Try clicking any node in the graph! It will show details and highlight connections in purple.',
      position: 'left'
    }
  },
  {
    element: '#graph-svg .nodes',
    popover: {
      title: 'Multi-Select',
      description: 'Try holding Shift and clicking multiple nodes to select them together! Great for comparing properties.',
      position: 'left'
    }
  },
  {
    element: '#graph-svg .groups',
    popover: {
      title: 'Application Groups',
      description: 'Orange circles represent applications containing their resources. Try clicking any application group to view details!',
      position: 'left'
    }
  },
  {
    element: '.refresh-button-wrapper',
    popover: {
      title: 'Refresh Data',
      description: 'Try clicking the refresh button (↻) to reload the graph data from the source. Useful when data has been updated. Avoid the disconnect button to keep the demo running!',
      position: 'left'
    }
  },
  {
    element: '.footer-toggle-btn',
    popover: {
      title: 'Footer Information',
      description: 'Try clicking this button to hide or show the footer with information about AstroViz, the Astrolabe ecosystem, and enterprise deployment options.',
      position: 'top'
    }
  }
];

export const tutorialConfig = {
  animate: true,
  overlayColor: 'rgba(0, 0, 0, 0.75)',
  smoothScroll: true,
  allowClose: true,
  overlayClickNext: false,
  doneBtnText: 'Finish',
  closeBtnText: 'Skip',
  nextBtnText: 'Next →',
  prevBtnText: '← Previous',
  showButtons: true,
  keyboardControl: true,
  showProgress: true,
  disableActiveInteraction: false,  // Allow clicking on highlighted elements
  allowKeyboardControl: true,
  overlayOpacity: 0.75
};