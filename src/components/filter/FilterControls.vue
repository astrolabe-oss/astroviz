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
        <option v-for="app in uniqueValues.appNames" :key="app" :value="app">{{ app }}</option>
      </select>
    </div>

    <div class="filter-item">
      <label for="provider">Provider:</label>
      <select id="provider" v-model="localFilters.provider" @change="emitFilterChange">
        <option value="">All</option>
        <option v-for="provider in uniqueValues.providers" :key="provider" :value="provider">{{ provider }}</option>
      </select>
    </div>

    <div class="filter-item">
      <label for="protocol-mux">Protocol Mux:</label>
      <select id="protocol-mux" v-model="localFilters.protocolMux" @change="emitFilterChange">
        <option value="">All</option>
        <option v-for="mux in sortedProtocolMuxes" :key="mux" :value="mux">{{ mux }}</option>
      </select>
    </div>

    <div class="filter-item" v-if="uniqueValues.addresses.length > 0">
      <label for="address">Address:</label>
      <select id="address" v-model="localFilters.address" @change="emitFilterChange">
        <option value="">All</option>
        <option v-for="addr in uniqueValues.addresses" :key="addr" :value="addr">{{ addr }}</option>
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
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 15px;
}

.filter-item {
  display: flex;
  flex-direction: column;
  min-width: 150px;
}

.filter-item label {
  font-size: 12px;
  margin-bottom: 4px;
  color: #666;
}

.filter-item select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.reset-button {
  align-self: flex-end;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px 12px;
  cursor: pointer;
  margin-top: auto;
}

.reset-button:hover {
  background-color: #e9e9e9;
}
</style>