// src/components/FilterBar.vue
<template>
  <div class="filter-bar">
    <ViewModeSelector v-model="localViewMode" />
    <FilterControls v-model="localFilters" :uniqueValues="uniqueValues" />
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
      this.$emit('update:viewMode', newMode);
    },

    // Watch for changes in filters
    localFilters: {
      handler(newFilters) {
        this.$emit('update:filters', newFilters);
      },
      deep: true
    },

    // Watch for prop changes to update local values
    viewMode(newMode) {
      this.localViewMode = newMode;
    },
    filters: {
      handler(newFilters) {
        this.localFilters = { ...newFilters };
      },
      deep: true
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