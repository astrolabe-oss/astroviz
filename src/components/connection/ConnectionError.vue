// src/components/connection/ConnectionError.vue
<template>
  <div v-if="error" class="error-banner">
    <p>{{ error }}</p>
    <button @click="retryConnection" class="retry-button">Retry Connection</button>
  </div>
</template>

<script>
export default {
  name: 'ConnectionError',

  props: {
    error: {
      type: String,
      default: ''
    }
  },

  methods: {
    retryConnection() {
      this.$emit('retry');
    }
  }
};
</script>

<style scoped>
.error-banner {
  background-color: #ffebee;
  border: 1px solid #ffcdd2;
  border-radius: 4px;
  padding: 10px 15px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-banner p {
  color: #c62828;
  margin: 0;
}

.retry-button {
  background-color: #2196F3;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  border: none;
  transition: background-color 0.2s;
}

.retry-button:hover {
  background-color: #1976D2;
}
</style>