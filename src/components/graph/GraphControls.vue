<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

// src/components/graph/GraphControls.vue
<template>
  <div class="controls">
    <button @click="$emit('zoom-in')" class="control-btn" title="Zoom In">+</button>
    <button @click="$emit('zoom-out')" class="control-btn" title="Zoom Out">−</button>
    <div class="zoom-level" v-if="currentZoomLevel">{{ Math.round(currentZoomLevel * 100) }}%</div>
    <button @click="$emit('reset-view')" class="control-btn" title="Reset View">⟳</button>
    <button @click="$emit('expand-all-apps')" class="control-btn" title="Expand All Applications">📂</button>
    <button @click="$emit('collapse-all-apps')" class="control-btn" title="Collapse All Applications">📁</button>
  </div>
</template>

<script>
export default {
  name: 'GraphControls',

  props: {
    currentZoomLevel: {
      type: Number,
      default: 1
    }
  }
};
</script>

<style scoped>
.controls {
  position: absolute;
  top: 10px;
  left: 15px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 5px;
  background-color: rgba(255, 255, 255, 0.85);
  padding: 5px;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.control-btn {
  font-size: 16px;
  font-weight: bold;
  width: 32px;
  height: 30px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.control-btn:hover {
  background-color: #f0f0f0;
}

.zoom-level {
  font-size: 12px;
  min-width: 40px;
  text-align: center;
  user-select: none;
}
</style>