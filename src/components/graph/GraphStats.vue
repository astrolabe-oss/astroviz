<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

// src/components/graph/GraphStats.vue
<template>
  <div class="graph-stats" v-if="show">
    <div>Nodes: {{ nodeCount }}</div>
    <div>Connections: {{ edgeCount }}</div>
  </div>
</template>

<script>
export default {
  name: 'GraphStats',

  props: {
    show: {
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
.graph-stats {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 8px 12px;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  font-size: 12px;
  z-index: 10;
}
</style>