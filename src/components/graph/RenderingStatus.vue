// src/components/graph/RenderingStatus.vue
<template>
  <div class="rendering-status" v-if="isRendering">
    <div class="spinner"></div>
    <span>Rendering {{ nodeCount }} nodes and {{ edgeCount }} connections...</span>
  </div>
</template>

<script>
export default {
  name: 'RenderingStatus',

  props: {
    isRendering: {
      type: Boolean,
      default: false
    },
    nodeCount: {
      type: Number,
      default: 0
    },
    edgeCount: {
      type: Number,
      default: 0
    }
  }
};
</script>

<style scoped>
.rendering-status {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 10px 15px;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  z-index: 10;
  font-size: 14px;
  pointer-events: none;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>]