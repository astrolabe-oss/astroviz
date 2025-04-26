<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

// src/components/connection/LoadingOverlay.vue
<template>
  <div v-if="loading" class="loading-overlay">
    <div class="loading-spinner"></div>
    <div class="loading-status">
      <p class="loading-title">Loading Data from Neo4j</p>
      <p class="loading-detail">{{ status }}</p>
      <div v-if="progress > 0" class="progress-bar">
        <div class="progress-fill" :style="{width: progress + '%'}"></div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LoadingOverlay',

  props: {
    loading: {
      type: Boolean,
      required: true
    },
    status: {
      type: String,
      default: 'Initializing...'
    },
    progress: {
      type: Number,
      default: 0
    }
  }
};
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 2s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-status {
  background-color: white;
  padding: 20px;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  width: 80%;
  text-align: center;
}

.loading-title {
  font-size: 18px;
  font-weight: bold;
  margin-top: 0;
  margin-bottom: 10px;
}

.loading-detail {
  margin-bottom: 15px;
  color: #666;
}

.progress-bar {
  width: 100%;
  height: 10px;
  background-color: #f3f3f3;
  border-radius: 5px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #4CAF50;
  transition: width 0.3s ease;
}
</style>