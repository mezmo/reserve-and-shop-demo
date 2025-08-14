import { VirtualUser } from './virtualUser.js';
import { selectWeightedJourney, USER_JOURNEYS } from './userJourneys.js';
import { trace } from '@opentelemetry/api';

class TrafficManager {
  constructor() {
    this.config = this.getDefaultConfig();
    this.activeUsers = new Map();
    this.spawnTimer = null;
    this.cleanupTimer = null;
    this.sessionCounter = 0;
    this.dailyStats = {
      totalSessions: 0,
      totalOrders: 0,
      sessionDurations: [],
      lastResetDate: new Date().toDateString()
    };

    // Start cleanup timer to remove completed users
    this.cleanupTimer = setInterval(() => {
      this.cleanupCompletedUsers();
    }, 10000); // Every 10 seconds
  }

  static getInstance() {
    if (!TrafficManager.instance) {
      TrafficManager.instance = new TrafficManager();
    }
    return TrafficManager.instance;
  }

  getDefaultConfig() {
    return {
      enabled: false,
      targetConcurrentUsers: 5,
      spawnIntervalMin: 30000,
      spawnIntervalMax: 120000,
      bounceRate: 0.15,
      journeyPattern: 'mixed',
      trafficTiming: 'steady'
    };
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(newConfig) {
    const wasEnabled = this.config.enabled;
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    console.log(`🔧 Config update: ${JSON.stringify({ old: oldConfig, new: this.config })}`);

    if (this.config.enabled && !wasEnabled) {
      console.log('🟢 Starting traffic (was disabled, now enabled)');
      this.start();
    } else if (!this.config.enabled && wasEnabled) {
      console.log('🔴 Stopping traffic (was enabled, now disabled)');
      this.stop();
    } else if (this.config.enabled && wasEnabled) {
      console.log('🔄 Traffic already running, continuing with new config');
      this.stop();
      setTimeout(() => this.start(), 100);
    } else {
      console.log('⚪ Traffic remains disabled');
    }
  }

  start() {
    if (!this.config.enabled) {
      console.log('🚫 Traffic manager not enabled, skipping start');
      return;
    }

    if (this.spawnTimer) {
      console.log('⚠️ Traffic manager already running');
      return;
    }

    console.log('🚦 Starting virtual traffic manager');
    console.log(`📊 Config: Target users: ${this.config.targetConcurrentUsers}, Pattern: ${this.config.journeyPattern}, Timing: ${this.config.trafficTiming}`);
    console.log(`⏱️ Spawn intervals: ${this.config.spawnIntervalMin}-${this.config.spawnIntervalMax}ms, Bounce rate: ${this.config.bounceRate}`);
    
    // Fast initial burst to reach target quickly
    this.performInitialBurst();
    
    this.scheduleNextSpawn();
  }

  stop() {
    console.log('🛑 Stopping virtual traffic manager');
    
    if (this.spawnTimer) {
      clearTimeout(this.spawnTimer);
      this.spawnTimer = null;
    }

    // Don't force-stop existing users, let them complete naturally
    console.log(`Allowing ${this.activeUsers.size} active users to complete their journeys`);
  }

  async performInitialBurst() {
    const currentUsers = this.activeUsers.size;
    const timingConfig = this.getTimingAdjustedIntervals();
    const targetUsers = Math.round(this.config.targetConcurrentUsers * timingConfig.targetAdjustment);
    
    if (currentUsers >= targetUsers) {
      console.log(`🎯 Already at target (${currentUsers}/${targetUsers}), skipping burst`);
      return;
    }

    const usersNeeded = targetUsers - currentUsers;
    console.log(`🚀 Initial burst: spawning ${usersNeeded} users to reach target ${targetUsers}`);
    
    // Spawn users rapidly with short delays
    for (let i = 0; i < usersNeeded; i++) {
      setTimeout(() => {
        this.spawnUser();
      }, i * 500); // 500ms between spawns for quick ramp-up
    }
  }

  getTimingAdjustedIntervals() {
    const base = {
      min: this.config.spawnIntervalMin,
      max: this.config.spawnIntervalMax
    };

    const timing = this.config.trafficTiming || 'steady';

    switch (timing) {
      case 'steady':
        return {
          min: base.min * 0.5,
          max: base.max * 0.7,
          targetAdjustment: 1
        };
      case 'peak':
        return {
          min: base.min * 0.3,
          max: base.max * 0.5,
          targetAdjustment: 1.5
        };
      case 'low':
        return {
          min: base.min * 2,
          max: base.max * 3,
          targetAdjustment: 0.6
        };
      case 'burst':
        const isBurst = Math.random() < 0.3;
        return isBurst ? {
          min: base.min * 0.1,
          max: base.max * 0.2,
          targetAdjustment: 2
        } : {
          min: base.min * 4,
          max: base.max * 6,
          targetAdjustment: 0.3
        };
      case 'normal':
      default:
        return {
          min: base.min,
          max: base.max,
          targetAdjustment: 1
        };
    }
  }

  scheduleNextSpawn() {
    if (!this.config.enabled) {
      console.log('🚫 Schedule cancelled: Traffic manager disabled');
      return;
    }

    const currentUsers = this.activeUsers.size;
    const timingConfig = this.getTimingAdjustedIntervals();
    const adjustedTarget = Math.round(this.config.targetConcurrentUsers * timingConfig.targetAdjustment);
    
    const variance = this.config.trafficTiming === 'steady' ? 0 : 2;
    const minUsers = Math.max(1, adjustedTarget - variance);
    const maxUsers = adjustedTarget + variance;

    let spawnDelay;
    let reason;

    if (this.config.trafficTiming === 'steady') {
      if (currentUsers < adjustedTarget) {
        spawnDelay = timingConfig.min;
        reason = `Maintaining steady target (${currentUsers} < ${adjustedTarget})`;
      } else if (currentUsers > adjustedTarget) {
        spawnDelay = timingConfig.max * 1.5;
        reason = `Over steady target (${currentUsers} > ${adjustedTarget})`;
      } else {
        spawnDelay = timingConfig.min * 1.5;
        reason = `At steady target (${currentUsers} = ${adjustedTarget})`;
      }
    } else {
      if (currentUsers < minUsers) {
        spawnDelay = timingConfig.min;
        reason = `Need users (${currentUsers} < ${minUsers})`;
      } else if (currentUsers >= maxUsers) {
        spawnDelay = timingConfig.max * 2;
        reason = `At capacity (${currentUsers} >= ${maxUsers})`;
      } else {
        spawnDelay = Math.random() * (timingConfig.max - timingConfig.min) + timingConfig.min;
        reason = `Normal range (${currentUsers} in ${minUsers}-${maxUsers})`;
      }
    }

    console.log(`⏰ Next spawn in ${Math.round(spawnDelay/1000)}s - ${reason} (Target: ${adjustedTarget}, Active: ${currentUsers}, Timing: ${this.config.trafficTiming})`);

    this.spawnTimer = setTimeout(() => {
      this.spawnUser();
      this.scheduleNextSpawn();
    }, spawnDelay);
  }

  getFilteredJourneys() {
    const pattern = this.config.journeyPattern || 'mixed';
    
    switch (pattern) {
      case 'buyers':
        return USER_JOURNEYS.filter(j => 
          j.name.toLowerCase().includes('buyer') || 
          j.name.toLowerCase().includes('purchaser') ||
          j.steps.some(step => step.action === 'checkout')
        );
      case 'browsers':
        return USER_JOURNEYS.filter(j => 
          j.name.toLowerCase().includes('browser') ||
          !j.steps.some(step => step.action === 'checkout')
        );
      case 'researchers':
        return USER_JOURNEYS.filter(j => 
          j.name.toLowerCase().includes('researcher') ||
          j.name.toLowerCase().includes('detailed') ||
          j.steps.filter(step => step.action === 'view_details').length > 1
        );
      case 'mixed':
      default:
        return USER_JOURNEYS;
    }
  }

  async spawnUser() {
    if (!this.config.enabled) return;

    // Check if OTEL tracing is properly initialized
    const tracerProvider = trace.getTracerProvider();
    if (!tracerProvider || tracerProvider.constructor.name === 'NoopTracerProvider') {
      console.log(`🚫 Traffic manager: OpenTelemetry tracer provider not initialized yet, skipping spawn`);
      return;
    }

    const currentUsers = this.activeUsers.size;
    const maxUsers = this.config.targetConcurrentUsers + 2;

    if (currentUsers >= maxUsers) {
      console.log(`🚫 Traffic manager: At capacity (${currentUsers}/${maxUsers}), skipping spawn`);
      return;
    }

    try {
      const userId = `traffic-user-${++this.sessionCounter}-${Date.now()}`;
      const filteredJourneys = this.getFilteredJourneys();
      const journey = selectWeightedJourney(filteredJourneys);
      const user = new VirtualUser(userId, journey, this);

      // Calculate expected duration based on journey steps
      const expectedDuration = journey.steps.reduce((total, step) => {
        const avgDuration = step.duration ? (step.duration.min + step.duration.max) / 2 : 2000;
        return total + avgDuration;
      }, 0);

      const activeUser = {
        user,
        startTime: Date.now(),
        expectedDuration,
        currentActivity: 'arriving',
        completed: false
      };

      this.activeUsers.set(userId, activeUser);
      this.dailyStats.totalSessions++;

      console.log(`🎭 Spawned virtual user ${userId} with journey: ${journey.name} (${currentUsers + 1}/${this.config.targetConcurrentUsers} active)`);

      // Start the user journey
      console.log(`🚀 Starting journey execution for user ${userId}`);
      this.executeUserJourney(userId, activeUser);

    } catch (error) {
      console.error('Error spawning virtual user:', error);
    }
  }

  async executeUserJourney(userId, activeUser) {
    try {
      // Check for early bounce
      if (Math.random() < this.config.bounceRate) {
        console.log(`🏃 User ${userId} bounced early`);
        activeUser.currentActivity = 'bounced';
        setTimeout(() => {
          this.completeUser(userId);
        }, Math.random() * 5000 + 1000); // 1-6 second bounce
        return;
      }

      // Execute the full journey
      activeUser.currentActivity = 'browsing';
      console.log(`🎬 User ${userId} starting executeJourney()`);
      await activeUser.user.executeJourney();
      console.log(`✅ User ${userId} completed executeJourney()`);
      
      // Check if it was a purchasing journey
      const journeyName = activeUser.user.getJourneyName();
      if (journeyName.includes('Buyer') || journeyName.includes('Purchaser')) {
        this.dailyStats.totalOrders++;
        activeUser.currentActivity = 'completed_purchase';
      } else {
        activeUser.currentActivity = 'completed_browsing';
      }

      this.completeUser(userId);

    } catch (error) {
      console.error(`Error executing journey for user ${userId}:`, error);
      activeUser.currentActivity = 'error';
      this.completeUser(userId);
    }
  }

  completeUser(userId) {
    const activeUser = this.activeUsers.get(userId);
    if (!activeUser) return;

    const sessionDuration = Date.now() - activeUser.startTime;
    this.dailyStats.sessionDurations.push(sessionDuration);
    
    // Keep only recent session durations (last 100) for performance
    if (this.dailyStats.sessionDurations.length > 100) {
      this.dailyStats.sessionDurations = this.dailyStats.sessionDurations.slice(-100);
    }

    activeUser.completed = true;

    console.log(`✅ User ${userId} completed session (${Math.round(sessionDuration / 1000)}s) - ${activeUser.currentActivity}`);
    
    // Immediate replacement spawning to maintain target count
    if (this.config.enabled && this.config.trafficTiming === 'steady') {
      const currentActiveUsers = Array.from(this.activeUsers.values()).filter(u => !u.completed).length;
      if (currentActiveUsers < this.config.targetConcurrentUsers) {
        console.log(`🔄 Immediate replacement: spawning new user (${currentActiveUsers}/${this.config.targetConcurrentUsers})`);
        setTimeout(() => {
          this.spawnUser();
        }, 1000); // Small delay to avoid overwhelming the system
      }
    }
  }

  cleanupCompletedUsers() {
    const toRemove = [];
    let completedCount = 0;
    let activeCount = 0;
    
    for (const [userId, activeUser] of this.activeUsers) {
      if (activeUser.completed) {
        completedCount++;
        // Remove completed users after 5 seconds for faster replacement
        const completedFor = Date.now() - (activeUser.startTime + activeUser.expectedDuration);
        if (completedFor > 5000) { // Remove after 5 seconds
          toRemove.push(userId);
        }
      } else {
        activeCount++;
      }
    }

    if (toRemove.length > 0) {
      console.log(`🧹 Cleaning up ${toRemove.length} completed users (${activeCount} still active, ${completedCount} completed)`);
      toRemove.forEach(userId => {
        this.activeUsers.delete(userId);
      });
    }
  }

  updateUserActivity(userId, activity, stepIndex, totalSteps) {
    const activeUser = this.activeUsers.get(userId);
    if (activeUser) {
      activeUser.currentActivity = activity;
      if (stepIndex !== undefined && totalSteps !== undefined) {
        activeUser.stepIndex = stepIndex;
        activeUser.totalSteps = totalSteps;
      }
    }
  }

  getStats() {
    const activeUsersArray = Array.from(this.activeUsers.values()).filter(u => !u.completed);
    const currentActivities = activeUsersArray.map(u => u.currentActivity);
    
    const averageSessionDuration = this.dailyStats.sessionDurations.length > 0
      ? this.dailyStats.sessionDurations.reduce((a, b) => a + b, 0) / this.dailyStats.sessionDurations.length
      : 0;

    const bounceRate = this.dailyStats.totalSessions > 0
      ? (this.dailyStats.sessionDurations.filter(d => d < 30000).length / this.dailyStats.totalSessions)
      : 0;

    return {
      activeUsers: activeUsersArray.length,
      totalSessionsToday: this.dailyStats.totalSessions,
      averageSessionDuration: Math.round(averageSessionDuration),
      currentActivities: currentActivities,
      totalOrders: this.dailyStats.totalOrders,
      bounceRate: Math.round(bounceRate * 100) / 100
    };
  }

  // Get detailed status for API
  getDetailedStatus() {
    const activeUsersArray = Array.from(this.activeUsers.values());
    const activeUsers = activeUsersArray.filter(u => !u.completed);
    const completedUsers = activeUsersArray.filter(u => u.completed);

    return {
      config: this.getConfig(),
      stats: this.getStats(),
      activeUsers: activeUsers.map(u => ({
        userId: u.user.userId,
        journey: u.user.getJourneyName(),
        activity: u.currentActivity,
        progress: u.user.getJourneyProgress(),
        startTime: u.startTime,
        customerName: u.user.customerProfile ? u.user.customerProfile.fullName : 'Unknown'
      })),
      recentlyCompleted: completedUsers.slice(-5).map(u => ({
        userId: u.user.userId,
        journey: u.user.getJourneyName(),
        activity: u.currentActivity,
        duration: Date.now() - u.startTime,
        customerName: u.user.customerProfile ? u.user.customerProfile.fullName : 'Unknown'
      }))
    };
  }

  // Cleanup on shutdown
  destroy() {
    this.stop();
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // Abort all active users
    for (const [userId, activeUser] of this.activeUsers) {
      if (!activeUser.completed) {
        activeUser.user.abort();
      }
    }
    
    this.activeUsers.clear();
  }
}

export {
  TrafficManager
};