<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div class="alpha-banner" v-if="!dismissed">
    <div class="banner-content">
      <div class="banner-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>
      <div class="banner-text">
        <p><strong>Exclusive Sneak Preview:</strong> You're getting early access to the <code>astrolabe</code> visualizer, <code>astroviz</code> pre-alpha! Official beta release coming soon.  Features are under active development.</p>
        <p>Found an issue? Share feedback on <a href="https://github.com/astrolabe-oss/astroviz/issues" target="_blank">GitHub Issues</a>. Currently serving <code>alpha/multi-network</code> feature branch. For increased stability, please use the <code>main</code> branch.</p>
      </div>
      <button class="banner-close-btn" @click="dismissBanner" title="Dismiss banner">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AlphaBanner',
  
  data() {
    return {
      dismissed: false
    };
  },
  
  mounted() {
    // Always show the banner on initial page load
    this.dismissed = false;
  },
  
  methods: {
    dismissBanner() {
      this.dismissed = true;
      // Only dismiss for current view, will reappear on refresh
    }
  }
};
</script>

<style scoped>
.alpha-banner {
  background-color: #ffebee;
  color: #c62828;
  border: 2px solid #ef5350;
  width: 100%;
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(198, 40, 40, 0.2);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 2px 10px rgba(198, 40, 40, 0.2);
  }
  50% {
    box-shadow: 0 2px 15px rgba(198, 40, 40, 0.4);
  }
  100% {
    box-shadow: 0 2px 10px rgba(198, 40, 40, 0.2);
  }
}

.banner-content {
  display: flex;
  align-items: flex-start;
  padding: 16px 20px;
}

.banner-icon {
  flex: 0 0 24px;
  color: #c62828;
  margin-right: 16px;
  margin-top: 2px;
}

.banner-text {
  flex: 1;
}

.banner-text p {
  margin: 0 0 8px 0;
  line-height: 1.5;
}

.banner-text p:last-child {
  margin-bottom: 0;
}

.banner-text a {
  color: #c62828;
  text-decoration: underline;
  font-weight: bold;
}

.banner-text a:hover {
  text-decoration: none;
}

.banner-text code {
  background-color: rgba(198, 40, 40, 0.1);
  padding: 2px 5px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9em;
}

.banner-close-btn {
  background: none;
  border: none;
  color: #c62828;
  cursor: pointer;
  padding: 5px;
  margin-left: 10px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.banner-close-btn:hover {
  background-color: rgba(198, 40, 40, 0.1);
}
</style>
