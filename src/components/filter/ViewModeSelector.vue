<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

// src/components/filter/ViewModeSelector.vue
<template>
  <div class="view-controls">
    <label class="view-mode-label">
      <input type="radio" v-model="localViewMode" value="detailed">
      <span class="radio-button"></span>
      Detailed View
    </label>
    <label class="view-mode-label">
      <input type="radio" v-model="localViewMode" value="application">
      <span class="radio-button"></span>
      Application View
    </label>
  </div>
</template>

<script>
export default {
  name: 'ViewModeSelector',

  props: {
    value: {
      type: String,
      default: 'detailed'
    }
  },

  data() {
    return {
      localViewMode: this.value
    };
  },

  watch: {
    // Watch for changes in view mode
    localViewMode(newMode) {
      this.$emit('input', newMode);
    },

    // Watch for prop changes to update local value
    value(newValue) {
      this.localViewMode = newValue;
    }
  }
};
</script>

<style scoped>
.view-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 5px;
  padding-bottom: 8px;
}

.view-mode-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
  user-select: none;
  font-size: 14px;
}

.view-mode-label input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
}

.radio-button {
  position: relative;
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-right: 6px;
  border: 2px solid #ccc;
  border-radius: 50%;
  box-sizing: border-box;
  transition: all 0.3s;
}

.view-mode-label input:checked ~ .radio-button {
  border-color: #4CAF50;
}

.view-mode-label input:checked ~ .radio-button:after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #4CAF50;
}
</style>