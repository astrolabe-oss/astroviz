// src/components/FilterBar.vue
<template>
  <div class="filter-bar">
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

      <div class="filter-item" v-if="uniqueValues.addresses.length > 0">
        <label for="address">Address:</label>
        <select id="address" v-model="localFilters.address">
          <option value="">All</option>
          <option v-for="addr in uniqueValues.addresses" :key="addr" :value="addr">{{ addr }}</option>
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
    'localFilters.address'(newValue) {
      this.$emit('update:filters', { ...this.localFilters, address: newValue });
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
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.view-controls {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e0e0e0;
}

.view-mode-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
  user-select: none;
}

.view-mode-label input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
}

.radio-button {
  position: relative;
  display: inline-block;
  width: 18px;
  height: 18px;
  margin-right: 8px;
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
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #4CAF50;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.filter-item {
  display: flex;
  flex-direction: column;
  min-width: 180px;
}

.filter-item label {
  margin-bottom: 5px;
  font-weight: bold;
  font-size: 14px;
  color: #555;
}

select {
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 14px;
  transition: border-color 0.3s;
}

select:focus {
  outline: none;
  border-color: #4CAF50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
}

.reset-button {
  align-self: flex-end;
  margin-left: auto;
  margin-top: auto;
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s;
}

.reset-button:hover {
  background-color: #45a049;
}

.reset-button:active {
  transform: translateY(1px);
}

@media (max-width: 768px) {
  .filters {
    flex-direction: column;
  }

  .filter-item {
    width: 100%;
  }

  .reset-button {
    margin-top: 15px;
    width: 100%;
  }
}
</style>