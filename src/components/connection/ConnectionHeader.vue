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
  height: 80px; /* Fixed height instead of 100% */
  padding: 0;
  margin: 0;
}

.logo {
  width: 220px; /* Fixed width for better control */
  height: 85px; /* Fixed height that matches the SVG's aspect ratio */
  display: block;
  padding: 0;
  margin: 0;
  object-fit: contain;
  object-position: left;
}
</style>