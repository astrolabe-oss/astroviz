<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

<template>
  <footer class="app-footer">
    <div class="footer-content">
      <div class="footer-section about">
        <h3>About AstroViz</h3>
        <p>
          AstroViz is an interactive network visualization tool designed for the 
          <a href="https://github.com/astrolabe-oss/astrolabe" target="_blank" rel="noopener">Astrolabe</a> 
          ecosystem. It provides hierarchical visualization of network topologies, applications, and infrastructure 
          connections with real-time Neo4j integration.
        </p>
      </div>
      
      <div class="footer-section ecosystem">
        <h3>Astrolabe Ecosystem</h3>
        <p>
          Part of the open-source <strong>Astrolabe</strong> project for network discovery and infrastructure mapping. 
          AstroViz serves as the visualization frontend for Astrolabe's graph database of network relationships.
        </p>
      </div>
      
      <div class="footer-section links">
        <h3>Learn More</h3>
        <ul>
          <li>
            <a href="https://github.com/astrolabe-oss/astrolabe" target="_blank" rel="noopener">
              🔗 Astrolabe Core Project
            </a>
          </li>
          <li>
            <a href="https://github.com/astrolabe-oss/astroviz" target="_blank" rel="noopener">
              🎨 AstroViz Repository
            </a>
          </li>
          <li>
            <a href="http://golightwire.com" target="_blank" rel="noopener">
              💼 Lightwire - Enterprise Solutions
            </a>
          </li>
        </ul>
      </div>
      
      <div class="footer-section enterprise">
        <h3>Enterprise Deployment</h3>
        <p>
          Interested in deploying Astrolabe and AstroViz in your infrastructure? 
          <a href="https://golightwire.com" target="_blank" rel="noopener">Contact Lightwire</a> 
          for professional support, custom integrations, and enterprise solutions.
        </p>
      </div>
    </div>
    
    <div class="footer-bottom">
      <p>&copy; 2025 Lightwire, LLC. Licensed under Apache 2.0.</p>
    </div>
  </footer>
</template>

<script>
export default {
  name: 'AppFooter'
};
</script>

<style scoped>
.app-footer {
  background: linear-gradient(135deg, #f8f9fa 0%, #e3f2fd 50%, #bbdefb 100%);
  color: #2c3e50;
  padding: 10px 20px 20px;
  border-top: 3px solid #4A98E3;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 30px;
  margin-bottom: 15px;
}

.footer-section h3 {
  color: #4A98E3;
  font-size: 18px;
  font-weight: 600;
  margin-top: 2px;
  margin-bottom: 8px;
  border-bottom: 2px solid #4A98E3;
  padding-bottom: 5px;
}

.footer-section p {
  line-height: 1.6;
  margin-bottom: 15px;
  color: #2c3e50;
}

.footer-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.footer-section li {
  margin-bottom: 10px;
}

.footer-section a {
  color: #4A98E3;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.footer-section a:hover {
  color: #3a7bc8;
  text-decoration: underline;
}

.footer-bottom {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid rgba(74, 152, 227, 0.3);
  color: #666;
  font-size: 14px;
}

@media (max-width: 768px) {
  .footer-content {
    grid-template-columns: 1fr;
    gap: 25px;
  }
  
  .app-footer {
    padding: 30px 15px 15px;
  }
  
  .footer-section h3 {
    font-size: 16px;
  }
}
</style>