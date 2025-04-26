// networkIcons.js - SVG icons for network diagrams

/**
 * Network diagram icons as inline SVG paths
 */
const networkIcons = {
  // Public IP icon (light grey cloud with dark outline)
  PublicIP: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 18">
      <path d="M0,12 Q0,8 3,7 Q5,5 9,6 Q11,2 16,5 Q20,5 22,8 Q24,11 21,14 L3,14 Q0,14 0,12 Z" 
            fill="#E0E0E0" stroke="#333333" stroke-width="1" />
    </svg>
  `,

  // Unknown node icon (orange circle with question mark)
  Unknown: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#F9C96E" stroke="#666666" stroke-width="0.5" />
      <text x="12" y="16" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#666666">?</text>
    </svg>
  `,

  // Server/Compute icon (rack server)
  Compute: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <rect x="4" y="3" width="16" height="18" rx="1" fill="currentColor" />
      <line x1="4" y1="8" x2="20" y2="8" stroke="#000" stroke-opacity="0.3" />
      <line x1="4" y1="13" x2="20" y2="13" stroke="#000" stroke-opacity="0.3" />
      <line x1="4" y1="18" x2="20" y2="18" stroke="#000" stroke-opacity="0.3" />
      <circle cx="7" cy="5.5" r="0.8" fill="#000" fill-opacity="0.5" />
      <circle cx="7" cy="10.5" r="0.8" fill="#000" fill-opacity="0.5" />
      <circle cx="7" cy="15.5" r="0.8" fill="#000" fill-opacity="0.5" />
    </svg>
  `,

  // Application icon (code/document)
  Application: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M14,2 L20,8 L20,22 L4,22 L4,2 L14,2 Z" fill="currentColor" />
      <path d="M14,2 L14,8 L20,8" fill="none" stroke="#000" stroke-opacity="0.3" />
      <line x1="8" y1="12" x2="16" y2="12" stroke="#000" stroke-opacity="0.3" />
      <line x1="8" y1="15" x2="16" y2="15" stroke="#000" stroke-opacity="0.3" />
      <line x1="8" y1="18" x2="12" y2="18" stroke="#000" stroke-opacity="0.3" />
    </svg>
  `,

  // Database icon (cylinder)
  Resource: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M12,2 C7.582,2 4,3.791 4,6 L4,18 C4,20.209 7.582,22 12,22 C16.418,22 20,20.209 20,18 L20,6 C20,3.791 16.418,2 12,2 Z" 
            fill="currentColor" />
      <ellipse cx="12" cy="6" rx="8" ry="3" fill="none" stroke="#000" stroke-opacity="0.3" />
      <path d="M4,12 C4,14.209 7.582,16 12,16 C16.418,16 20,14.209 20,12" 
            fill="none" stroke="#000" stroke-opacity="0.3" />
    </svg>
  `,

  // Traffic Controller icon with arrows contained within the box
  TrafficController: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <!-- Main container - blue square with rounded corners -->
      <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" />
      
      <!-- Input arrow from top (properly contained) -->
      <line x1="12" y1="4.5" x2="12" y2="9" stroke="#000" stroke-opacity="0.6" stroke-width="1.5" />
      <polygon points="10,8 12,11 14,8" fill="#000" fill-opacity="0.6" />
      
      <!-- Output arrow to left (now inside the box) -->
      <line x1="8" y1="12" x2="5" y2="12" stroke="#000" stroke-opacity="0.6" stroke-width="1.5" />
      <polygon points="7,10 4,12 7,14" fill="#000" fill-opacity="0.6" />
      
      <!-- Output arrow to right (now inside the box) -->
      <line x1="16" y1="12" x2="19" y2="12" stroke="#000" stroke-opacity="0.6" stroke-width="1.5" />
      <polygon points="17,10 20,12 17,14" fill="#000" fill-opacity="0.6" />
      
      <!-- Output arrow to bottom (fully contained) -->
      <line x1="12" y1="15" x2="12" y2="19" stroke="#000" stroke-opacity="0.6" stroke-width="1.5" />
      <polygon points="10,17 12,19.5 14,17" fill="#000" fill-opacity="0.6" />
    </svg>
  `,

  // Deployment/Cluster icon (3 stacked squares with visible layers)
  Deployment: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <!-- Bottom square (layer 3) - visible outline -->
      <rect x="8" y="12" width="12" height="10" rx="1" fill="currentColor" />
      <rect x="8" y="12" width="12" height="10" rx="1" fill="none" stroke="#000" stroke-opacity="0.2" />
      
      <!-- Middle square (layer 2) - visible outline -->
      <rect x="6" y="8" width="12" height="10" rx="1" fill="currentColor" />
      <rect x="6" y="8" width="12" height="10" rx="1" fill="none" stroke="#000" stroke-opacity="0.2" />
      
      <!-- Top square (layer 1) - visible outline -->
      <rect x="4" y="4" width="12" height="10" rx="1" fill="currentColor" />
      <rect x="4" y="4" width="12" height="10" rx="1" fill="none" stroke="#000" stroke-opacity="0.2" />
    </svg>
  `,

  // Default icon (circle)
  default: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
    </svg>
  `
};

export default networkIcons;