<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

// src/components/filter/FilterControls.vue
<template>
  <div class="filters">
    <div class="filter-item">
      <label for="app-name">App Name:</label>
      <select id="app-name" v-model="localFilters.appName" @change="emitFilterChange">
        <option value="">All</option>
        <option v-for="app in uniqueValues.appNames" :key="app" :value="app" :title="app">{{ app }}</option>
      </select>
    </div>

    <div class="filter-item">
      <label for="provider">Provider:</label>
      <select id="provider" v-model="localFilters.provider" @change="emitFilterChange">
        <option value="">All</option>
        <option v-for="provider in uniqueValues.providers" :key="provider" :value="provider" :title="provider">{{ provider }}</option>
      </select>
    </div>

    <div class="filter-item">
      <label for="protocol-mux">Protocol Mux:</label>
      <select id="protocol-mux" v-model="localFilters.protocolMux" @change="emitFilterChange">
        <option value="">All</option>
        <option v-for="mux in sortedProtocolMuxes" :key="mux" :value="mux" :title="mux">{{ mux }}</option>
      </select>
    </div>

    <div class="filter-item" v-if="uniqueValues.addresses.length > 0">
      <label for="address">Address:</label>
      <select id="address" v-model="localFilters.address" @change="emitFilterChange">
        <option value="">All</option>
        <option v-for="addr in uniqueValues.addresses" :key="addr" :value="addr" :title="addr">{{ addr }}</option>
      </select>
    </div>

    <div class="filter-item">
      <label for="public-ip">IP Type:</label>
      <select id="public-ip" v-model="localFilters.publicIp" @change="emitFilterChange">
        <option value="">All</option>
        <option value="public">Public</option>
        <option value="private">Private</option>
      </select>
    </div>
    
    <div class="filter-item reset-container">
      <label>&nbsp;</label>
      <button @click="resetFilters" class="reset-button">Reset Filters</button>
    </div>
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

  computed: {
    /**
     * Sort protocol multiplexors numerically instead of alphabetically
     * @returns {Array} Sorted array of protocol multiplexors
     */
    sortedProtocolMuxes() {
      if (!this.uniqueValues.protocolMuxes || !this.uniqueValues.protocolMuxes.length) {
        return [];
      }

      return [...this.uniqueValues.protocolMuxes].sort((a, b) => {
        // Convert to integers for numerical sorting
        const aInt = parseInt(a, 10);
        const bInt = parseInt(b, 10);

        // If both are valid numbers, sort numerically
        if (!isNaN(aInt) && !isNaN(bInt)) {
          return aInt - bInt;
        }

        // If only one is a valid number, put numbers first
        if (!isNaN(aInt)) return -1;
        if (!isNaN(bInt)) return 1;

        // Otherwise, fall back to string comparison
        return a.localeCompare(b);
      });
    }
  },

  watch: {
    // Sync prop changes with local data
    value: {
      handler(newVal) {
        this.localFilters = { ...newVal };
      },
      deep: true
    }
  },

  methods: {
    /**
     * Emit filter changes to parent component
     */
    emitFilterChange() {
      this.$emit('input', { ...this.localFilters });
    },

    /**
     * Reset all filters to default state
     */
    resetFilters() {
      this.localFilters = {
        appName: '',
        provider: '',
        protocolMux: '',
        address: '',
        publicIp: ''
      };
      this.emitFilterChange();
    }
  }
};
</script>

<style scoped>
.filters {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  width: 100%;
}

.filter-item {
  display: flex;
  flex-direction: column;
  min-width: 120px;
  flex: 1;
}

.filter-item label {
  font-size: 12px;
  margin-bottom: 4px;
  color: #555;
  font-weight: 500;
  white-space: nowrap;
}

.filter-item select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  text-overflow: ellipsis;
  width: 100%;
}

.reset-container {
  min-width: auto;
  flex: 0 0 auto;
}

.reset-button {
  background-color: #e8e8e8;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #666;
  height: 35px;
  white-space: nowrap;
}

.reset-button:hover {
  background-color: #d8d8d8;
  color: #333;
}
</style>