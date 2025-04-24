// src/main.js
import Vue from 'vue';
import App from './App.vue';

Vue.config.productionTip = false;

// Register global error handlers
Vue.config.errorHandler = function(err, vm, info) {
    console.error('Vue Error:', err);
    console.error('Component:', vm);
    console.error('Error Info:', info);
};

window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global Error:', message);
    console.error('Source:', source);
    console.error('Line:', lineno);
    console.error('Column:', colno);
    console.error('Error Object:', error);
    return false;
};

// Create and mount the Vue instance
console.log('MAIN: Creating Vue instance');
new Vue({
    render: h => h(App)
}).$mount('#app');

console.log('MAIN: Application mounted');