<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

<template>
  <footer class="app-footer" :class="{ collapsed: isCollapsed }">
    <div class="footer-header" v-show="isCollapsed">
      <span class="footer-copyright">&copy; 2025 Lightwire, LLC. Licensed under Apache 2.0.</span>
    </div>
    
    <button @click="toggleFooter" class="footer-toggle-btn" :title="isCollapsed ? 'Show footer details' : 'Hide footer details'">
      <svg :class="{ rotated: !isCollapsed }" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="18,15 12,9 6,15"></polyline>
      </svg>
      {{ isCollapsed ? 'Show Footer' : 'Hide Footer' }}
    </button>
    
    <div class="footer-content" v-show="!isCollapsed">
      <div class="footer-section about">
        <h3>About AstroViz</h3>
        <p>
          AstroViz is an interactive network visualization tool designed for the 
          <a href="https://github.com/astrolabe-oss/astrolabe" target="_blank" rel="noopener">Astrolabe</a> 
          ecosystem.
        </p>
      </div>
      
      <div class="footer-section ecosystem">
        <h3>Astrolabe Ecosystem</h3>
        <p>
          Part of the open-source <strong>Astrolabe</strong> project for network discovery and infrastructure mapping.
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
          .
        </p>
      </div>
    </div>
    
      <div class="footer-bottom" v-show="!isCollapsed">
        <p>&copy; 2025 Lightwire, LLC. Licensed under Apache 2.0.</p>
      </div>
    </div>
  </footer>
</template>

<script>
export default {
  name: 'AppFooter',
  
  data() {
    return {
      isCollapsed: localStorage.getItem('astroviz_footer_collapsed') === 'true'
    };
  },
  
  methods: {
    toggleFooter() {
      this.isCollapsed = !this.isCollapsed;
      localStorage.setItem('astroviz_footer_collapsed', this.isCollapsed.toString());
      this.$emit('toggle', this.isCollapsed);
    }
  }
};
</script>

<style scoped>
.app-footer {
  background: linear-gradient(135deg, #f8f9fa 0%, #e3f2fd 50%, #bbdefb 100%);
  color: #2c3e50;
  padding: 10px 20px 20px;
  border-top: 3px solid #4A98E3;
  position: relative;
  transition: max-height 0.3s ease, padding 0.3s ease;
  overflow: hidden;
  max-height: 200px;
}

.app-footer.collapsed {
  max-height: 35px;
  padding-bottom: 8px;
}

.footer-header {
  position: relative;
  padding: 8px 0;
  text-align: center;
}

.footer-copyright {
  color: #666;
  font-size: 12px;
}

.footer-toggle-btn {
  position: absolute;
  top: 8px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #4A98E3;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 100;
}

.footer-toggle-btn:hover {
  background: #3a7bc8;
}

.footer-toggle-btn svg {
  transition: transform 0.2s ease;
}

.footer-toggle-btn svg.rotated {
  transform: rotate(180deg);
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  padding: 20px;
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
  grid-column: 1 / -1;
  position: relative;
}

.footer-bottom p {
  margin: 0;
}


@media (max-width: 1024px) {
  .footer-content {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .footer-content {
    grid-template-columns: 1fr;
    gap: 15px;
    padding: 15px;
  }
  
  .footer-section h3 {
    font-size: 16px;
  }
}
</style>