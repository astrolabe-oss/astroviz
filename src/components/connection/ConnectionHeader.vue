<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

// src/components/connection/ConnectionHeader.vue
<template>
  <div class="logo-wrapper">
    <img src="/logo.svg" alt="AstroViz Logo" class="logo" />
  </div>
</template>

<script>
export default {
  name: 'ConnectionHeader',

  props: {
    connected: {
      type: Boolean,
      required: true
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
.logo-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.logo {
  width: 100%;
  max-width: 250px;
  min-width: 200px;
  height: auto;
  display: block;
  padding: 0;
  margin: 0;
  transform: translateY(8px); /* Move the logo down slightly */
}

/* Ensure SVG renders properly */
.logo svg {
  width: 100%;
  height: auto;
}
</style>