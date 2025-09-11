<!--
  Copyright 2025 Lightwire, LLC
  SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div class="tutorial-container">
    <button 
      v-if="showTutorialButton"
      @click="startTutorial" 
      class="tutorial-button"
      title="Take a tour of the features"
    >
      <svg class="tutorial-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
      Take a Tour
    </button>
  </div>
</template>

<script>
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { tutorialSteps, tutorialConfig } from '@/utils/tutorialSteps';

export default {
  name: 'TutorialOverlay',

  props: {
    autoStart: {
      type: Boolean,
      default: false
    },
    isDemo: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      driverObj: null,
      showTutorialButton: true,
      hasSeenTutorial: false
    };
  },

  mounted() {
    // Check if user has seen tutorial before
    this.hasSeenTutorial = localStorage.getItem('astroviz_tutorial_seen') === 'true';
    
    // Auto-start logic
    let shouldAutoStart = false;
    if (this.isDemo) {
      // In demo mode, always auto-start (every page refresh)
      shouldAutoStart = true;
    } else {
      // In production mode, only auto-start if user hasn't seen it and autoStart is true
      shouldAutoStart = !this.hasSeenTutorial && this.autoStart;
    }
    
    if (shouldAutoStart) {
      // Delay to let the app fully render
      setTimeout(() => {
        this.startTutorial();
      }, 500);
    }
  },

  beforeDestroy() {
    if (this.driverObj) {
      this.driverObj.destroy();
    }
  },

  methods: {
    startTutorial() {
      // Initialize driver.js with our configuration
      this.driverObj = driver({
        ...tutorialConfig,
        steps: tutorialSteps,
        onDestroyStarted: () => {
          // Mark tutorial as seen when completed or skipped
          localStorage.setItem('astroviz_tutorial_seen', 'true');
          this.hasSeenTutorial = true;
          
          // Cleanup
          if (this.driverObj) {
            this.driverObj.destroy();
            this.driverObj = null;
          }
        },
        onNextClick: () => {
          this.driverObj.moveNext();
        },
        onPrevClick: () => {
          this.driverObj.movePrevious();
        },
        onCloseClick: () => {
          this.driverObj.destroy();
        }
      });

      // Start the tour
      this.driverObj.drive();
    },

    resetTutorial() {
      // Clear the seen flag to allow tutorial to run again
      localStorage.removeItem('astroviz_tutorial_seen');
      this.hasSeenTutorial = false;
    }
  }
};
</script>

<style scoped>
.tutorial-container {
  position: absolute;
  bottom: 15px;
  right: 15px;
  z-index: 200;
}

.tutorial-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tutorial-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
}

.tutorial-icon {
  width: 16px;
  height: 16px;
}

/* Override driver.js styles for better integration */
:global(.driver-popover) {
  border-radius: 8px !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2) !important;
}

:global(.driver-popover-title) {
  font-size: 16px !important;
  font-weight: 600 !important;
  color: #2c3e50 !important;
  margin-bottom: 8px !important;
}

:global(.driver-popover-description) {
  font-size: 14px !important;
  line-height: 1.5 !important;
  color: #4a5568 !important;
}

:global(.driver-popover-footer) {
  margin-top: 16px !important;
}

:global(.driver-popover-navigation-btns button) {
  background: #667eea !important;
  color: white !important;
  border: none !important;
  border-radius: 4px !important;
  padding: 6px 12px !important;
  font-size: 13px !important;
  cursor: pointer !important;
  transition: background 0.2s !important;
  text-shadow: none !important;
  font-weight: 500 !important;
}

:global(.driver-popover-navigation-btns button:hover) {
  background: #764ba2 !important;
}

:global(.driver-popover-close-btn) {
  color: #999 !important;
  font-size: 12px !important;
}

:global(.driver-popover-arrow) {
  background: white !important;
}

/* Add bouncing arrow animation */
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

:global(.driver-highlighted-element) {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(102, 126, 234, 0); }
  100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0); }
}
</style>