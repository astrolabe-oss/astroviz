// src/components/filter/FilterControls.vue
<template>
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
</template>

<script>
export default {
  name: 'FilterControls',

  props: {
    uniqueValues: {
      type: Object,
      required: true
    },
    value: {
      type: Object,
      required: true
    }
  },

  data() {
    return {
      localFilters: { ...this.value }
    };
  },

  watch: {
    // Watch for changes in filters
    'localFilters.appName'(newValue) {
      const updatedFilters = { ...this.localFilters, appName: newValue };
      this.$emit('input', updatedFilters);
    },
    'localFilters.provider'(newValue) {
      const updatedFilters = { ...this.localFilters, provider: newValue };
      this.$emit('input', updatedFilters);
    },
    'localFilters.protocolMux'(newValue) {
      const updatedFilters = { ...this.localFilters, protocolMux: newValue };
      this.$emit('input', updatedFilters);
    },
    'localFilters.address'(newValue) {
      const updatedFilters = { ...this.localFilters, address: newValue };
      this.$emit('input', updatedFilters);
    },

    // Watch for prop changes to update local values
    value: {
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
      this.$emit('input', { ...this.localFilters });
    }
  }
};
</script>

<style scoped>
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