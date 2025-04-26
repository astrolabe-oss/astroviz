<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

// src/components/FilterBar.vue
<template>
  <div class="filter-bar">
    <ViewModeSelector v-model="localViewMode" />
    <FilterControls :uniqueValues="uniqueValues" :value="localFilters" @input="handleFilterChange" />
  </div>
</template>

<script>
import ViewModeSelector from './filter/ViewModeSelector.vue';
import FilterControls from './filter/FilterControls.vue';

export default {
  name: 'FilterBar',

  components: {
    ViewModeSelector,
    FilterControls
  },

  props: {
    // Unique values from the graph data for select options
    uniqueValues: {
      type: Object,
      required: true
    },
    // Current view mode: 'detailed' or 'application'
    viewMode: {
      type: String,
      required: true
    },
    // Current filters
    filters: {
      type: Object,
      required: true
    }
  },

  data() {
    return {
      // Local copies of props for two-way binding
      localViewMode: this.viewMode,
      localFilters: { ...this.filters }
    };
  },

  watch: {
    // Watch for changes in view mode
    localViewMode(newMode) {
      if (newMode !== this.viewMode) {
        this.$emit('update:viewMode', newMode);
      }
    },

    // Watch for prop changes to update local values
    viewMode(newMode) {
      if (this.localViewMode !== newMode) {
        this.localViewMode = newMode;
      }
    },

    filters: {
      handler(newFilters) {
        // Only update if the values are actually different
        if (JSON.stringify(this.localFilters) !== JSON.stringify(newFilters)) {
          this.localFilters = { ...newFilters };
        }
      },
      deep: true
    }
  },

  methods: {
    /**
     * Handle filter changes from FilterControls component
     */
    handleFilterChange(newFilters) {
      // Only update if the values are actually different
      if (JSON.stringify(this.localFilters) !== JSON.stringify(newFilters)) {
        this.localFilters = { ...newFilters };
        this.$emit('update:filters', { ...newFilters });
      }
    }
  }
};
</script>

<style scoped>
.filter-bar {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>