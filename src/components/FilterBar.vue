<template>
  <div class="filter-bar">
    <div class="view-controls">
      <label class="view-mode-label">
        <input type="radio" v-model="localViewMode" value="detailed"> Detailed View
      </label>
      <label class="view-mode-label">
        <input type="radio" v-model="localViewMode" value="application"> Application View
      </label>
    </div>

    <div class="filters">
      <div class="filter-item">
        <label for="app-name">App Name:</label>
        <select id="app-name" v-model="localFilters.appName">
          <option value="">All</option>
          <option v-for="app in uniqueValues.appNames" :key="app" :value="app">{{ app }}</option>
        </select>
      </div>

      <div class="filter-item">
        <label for="provider">Provider:</label>
        <select id="provider" v-model="localFilters.provider">
          <option value="">All</option>
          <option v-for="provider in uniqueValues.providers" :key="provider" :value="provider">{{ provider }}</option>
        </select>
      </div>

      <div class="filter-item">
        <label for="protocol-mux">Protocol Mux:</label>
        <select id="protocol-mux" v-model="localFilters.protocolMux">
          <option value="">All</option>
          <option v-for="mux in uniqueValues.protocolMuxes" :key="mux" :value="mux">{{ mux }}</option>
        </select>
      </div>

      <button @click="resetFilters" class="reset-button">Reset Filters</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FilterBar',

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
    'localFilters.appName'(newValue) {
      this.$emit('update:filters', { ...this.localFilters, appName: newValue });
    },
    'localFilters.provider'(newValue) {
      this.$emit('update:filters', { ...this.localFilters, provider: newValue });
    },
    'localFilters.protocolMux'(newValue) {
      this.$emit('update:filters', { ...this.localFilters, protocolMux: newValue });
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
  },

  methods: {
    /**
     * Reset all filters to initial state
     */
    resetFilters() {
      this.localFilters = {
        appName: '',
        provider: '',
        protocolMux: '',
        address: ''
      };
      this.$emit('update:filters', { ...this.localFilters });
    }
  }
};
</script>

<style scoped>
.filter-bar {
  margin-bottom: 15px;
}

.view-controls {
  margin-bottom: 10px;
}

.view-mode-label {
  margin-right: 15px;
  cursor: pointer;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 15px;
}

.filter-item {
  display: flex;
  flex-direction: column;
}

.filter-item label {
  margin-bottom: 5px;
  font-weight: bold;
}

select {
  padding: 6px;
  width: 150px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.reset-button {
  align-self: flex-end;
  padding: 6px 12px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: auto;
}

.reset-button:hover {
  background-color: #45a049;
}
</style>