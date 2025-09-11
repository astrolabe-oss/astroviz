<template>
  <div class="demo-mode-banner">
    <div class="banner-content">
      <div class="banner-icon">🚀</div>
      <div class="banner-text">
        <strong>Demo Mode</strong> - You're viewing sample data. Configure Neo4j environment variables to connect to your own database.
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DemoModeBanner'
}
</script>

<style scoped>
.demo-mode-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 1000;
  margin-bottom: 5px;
}

.banner-content {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 1200px;
  margin: 0 auto;
  gap: 12px;
}

.banner-icon {
  font-size: 20px;
  animation: pulse 2s infinite;
}

.banner-text {
  font-size: 14px;
  line-height: 1.4;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

@media (max-width: 768px) {
  .demo-mode-banner {
    padding: 10px 16px;
  }
  
  .banner-text {
    font-size: 13px;
  }
  
  .banner-icon {
    font-size: 18px;
  }
}
</style>