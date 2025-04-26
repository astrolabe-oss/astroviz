<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

// src/components/connection/ConnectionHeader.vue
<template>
  <header class="header">
    <h1>Astrolabe Network Visualizer</h1>
    <div v-if="connected" class="connection-info">
      Connected to: {{ connectionInfo }}
      <button @click="disconnect" class="disconnect-button">Disconnect</button>
    </div>
    <button v-else @click="connect" class="connect-button">Connect to Neo4j</button>
  </header>
</template>

<script>
export default {
  name: 'ConnectionHeader',

  props: {
    connected: {
      type: Boolean,
      required: true
    },
    connectionInfo: {
      type: String,
      default: ''
    }
  },

  methods: {
    connect() {
      this.$emit('connect');
    },
    disconnect() {
      this.$emit('disconnect');
    }
  }
};
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #ddd;
  padding-bottom: 10px;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.connect-button, .disconnect-button {
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  border: none;
  transition: background-color 0.2s;
}

.connect-button {
  background-color: #4CAF50;
  color: white;
}

.connect-button:hover {
  background-color: #45a049;
}

.disconnect-button {
  background-color: #f44336;
  color: white;
}

.disconnect-button:hover {
  background-color: #d32f2f;
}
</style>