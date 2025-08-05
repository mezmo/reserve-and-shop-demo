import { VirtualUser } from './virtualUser';
import { selectWeightedJourney, USER_JOURNEYS } from './userJourneys';

export interface TrafficStats {
  activeUsers: number;
  totalSessionsToday: number;
  averageSessionDuration: number;
  currentActivities: string[];
  totalOrders: number;
  bounceRate: number;
}

export interface TrafficConfig {
  enabled: boolean;
  targetConcurrentUsers: number;
  spawnIntervalMin: number; // milliseconds
  spawnIntervalMax: number; // milliseconds
  bounceRate: number; // probability (0-1) that a user leaves early
  journeyPattern: 'mixed' | 'buyers' | 'browsers' | 'researchers';
  trafficTiming: 'steady' | 'normal' | 'peak' | 'low' | 'burst';
}

interface ActiveUser {
  user: VirtualUser;
  startTime: number;
  expectedDuration: number;
  currentActivity: string;
  completed: boolean;
}

export class TrafficManager {
  private static instance: TrafficManager | null = null;
  private config: TrafficConfig;
  private activeUsers: Map<string, ActiveUser> = new Map();
  private spawnTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private sessionCounter: number = 0;
  private dailyStats: {
    totalSessions: number;
    totalOrders: number;
    sessionDurations: number[];
    lastResetDate: string;
  } = {
    totalSessions: 0,
    totalOrders: 0,
    sessionDurations: [],
    lastResetDate: new Date().toDateString()
  };

  private constructor() {
    this.config = this.loadConfig();
    this.loadDailyStats();
    
    // Start cleanup timer to remove completed users
    this.cleanupTimer = setInterval(() => {
      this.cleanupCompletedUsers();
    }, 10000); // Every 10 seconds for more responsive cleanup
  }

  public static getInstance(): TrafficManager {
    if (!TrafficManager.instance) {
      TrafficManager.instance = new TrafficManager();
    }
    return TrafficManager.instance;
  }

  private loadConfig(): TrafficConfig {
    try {
      const saved = localStorage.getItem('virtual-traffic-config');
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Check if we need to migrate old config (missing new fields)
        if (!parsed.journeyPattern || !parsed.trafficTiming) {
          console.log('🔄 Migrating old traffic config to include new fields');
          // Clear old config and use defaults
          localStorage.removeItem('virtual-traffic-config');
          return this.getDefaultConfig();
        }
        
        return {
          enabled: parsed.enabled || false,
          targetConcurrentUsers: parsed.targetConcurrentUsers || 5,
          spawnIntervalMin: parsed.spawnIntervalMin || 30000, // 30 seconds
          spawnIntervalMax: parsed.spawnIntervalMax || 120000, // 2 minutes
          bounceRate: parsed.bounceRate !== undefined ? parsed.bounceRate : 0.15, // Default to 0.15
          journeyPattern: parsed.journeyPattern || 'mixed', // Default to mixed
          trafficTiming: parsed.trafficTiming || 'steady' // Default to steady
        };
      }
    } catch (error) {
      console.error('Error loading traffic config:', error);
    }
    
    return this.getDefaultConfig();
  }

  private getDefaultConfig(): TrafficConfig {
    return {
      enabled: false,
      targetConcurrentUsers: 5,
      spawnIntervalMin: 30000,
      spawnIntervalMax: 120000,
      bounceRate: 0.15, // Reduced from 0.3 to keep more users active longer
      journeyPattern: 'mixed',
      trafficTiming: 'steady'
    };
  }

  private saveConfig(): void {
    try {
      localStorage.setItem('virtual-traffic-config', JSON.stringify(this.config));
    } catch (error) {
      console.error('Error saving traffic config:', error);
    }
  }

  private loadDailyStats(): void {
    try {
      const saved = localStorage.getItem('virtual-traffic-daily-stats');
      if (saved) {
        const parsed = JSON.parse(saved);
        const today = new Date().toDateString();
        
        if (parsed.lastResetDate === today) {
          this.dailyStats = parsed;
        } else {
          // New day, reset stats
          this.resetDailyStats();
        }
      }
    } catch (error) {
      console.error('Error loading daily stats:', error);
      this.resetDailyStats();
    }
  }

  private saveDailyStats(): void {
    try {
      localStorage.setItem('virtual-traffic-daily-stats', JSON.stringify(this.dailyStats));
    } catch (error) {
      console.error('Error saving daily stats:', error);
    }
  }

  private resetDailyStats(): void {
    this.dailyStats = {
      totalSessions: 0,
      totalOrders: 0,
      sessionDurations: [],
      lastResetDate: new Date().toDateString()
    };
    this.saveDailyStats();
  }

  public updateConfig(newConfig: Partial<TrafficConfig>): void {
    const wasEnabled = this.config.enabled;
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();

    console.log('🔧 Config update:', { old: oldConfig, new: this.config });

    if (this.config.enabled && !wasEnabled) {
      console.log('🟢 Starting traffic (was disabled, now enabled)');
      this.start();
    } else if (!this.config.enabled && wasEnabled) {
      console.log('🔴 Stopping traffic (was enabled, now disabled)');
      this.stop();
    } else if (this.config.enabled && wasEnabled) {
      console.log('🔄 Traffic already running, continuing with new config');
      // Optionally restart to apply new timing immediately
      this.stop();
      setTimeout(() => this.start(), 100);
    } else {
      console.log('⚪ Traffic remains disabled');
    }
  }

  public start(): void {
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

  public stop(): void {
    console.log('🛑 Stopping virtual traffic manager');
    
    if (this.spawnTimer) {
      clearTimeout(this.spawnTimer);
      this.spawnTimer = null;
    }

    // Don't force-stop existing users, let them complete naturally
    console.log(`Allowing ${this.activeUsers.size} active users to complete their journeys`);
  }

  private async performInitialBurst(): Promise<void> {
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

  private getTimingAdjustedIntervals(): { min: number; max: number; targetAdjustment: number } {
    const base = {
      min: this.config.spawnIntervalMin,
      max: this.config.spawnIntervalMax
    };

    // Handle undefined trafficTiming (fallback to steady)
    const timing = this.config.trafficTiming || 'steady';

    switch (timing) {
      case 'steady':
        return {
          min: base.min * 0.5, // Faster response to maintain target
          max: base.max * 0.7,
          targetAdjustment: 1 // Exact target users
        };
      case 'peak':
        return {
          min: base.min * 0.3, // Spawn 3x faster
          max: base.max * 0.5,
          targetAdjustment: 1.5 // 50% more concurrent users
        };
      case 'low':
        return {
          min: base.min * 2, // Spawn 2x slower
          max: base.max * 3,
          targetAdjustment: 0.6 // 40% fewer concurrent users
        };
      case 'burst':
        // Random bursts of activity
        const isBurst = Math.random() < 0.3; // 30% chance of burst
        return isBurst ? {
          min: base.min * 0.1, // Very fast spawning during burst
          max: base.max * 0.2,
          targetAdjustment: 2 // Double users during burst
        } : {
          min: base.min * 4, // Very slow between bursts
          max: base.max * 6,
          targetAdjustment: 0.3 // Few users between bursts
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

  private scheduleNextSpawn(): void {
    if (!this.config.enabled) {
      console.log('🚫 Schedule cancelled: Traffic manager disabled');
      return;
    }

    const currentUsers = this.activeUsers.size;
    const timingConfig = this.getTimingAdjustedIntervals();
    const adjustedTarget = Math.round(this.config.targetConcurrentUsers * timingConfig.targetAdjustment);
    
    // Variance depends on timing mode
    const variance = this.config.trafficTiming === 'steady' ? 0 : 2; // No variance for steady mode
    const minUsers = Math.max(1, adjustedTarget - variance);
    const maxUsers = adjustedTarget + variance;

    let spawnDelay: number;
    let reason: string;

    if (this.config.trafficTiming === 'steady') {
      // Steady mode: maintain exact target
      if (currentUsers < adjustedTarget) {
        // Spawn immediately to reach target
        spawnDelay = timingConfig.min;
        reason = `Maintaining steady target (${currentUsers} < ${adjustedTarget})`;
      } else if (currentUsers > adjustedTarget) {
        // Wait moderately when over target, but not too long
        spawnDelay = timingConfig.max * 1.5; // Reduced from 3x to 1.5x
        reason = `Over steady target (${currentUsers} > ${adjustedTarget})`;
      } else {
        // At exact target, check frequently for replacements
        spawnDelay = timingConfig.min * 1.5; // Reduced from 2x to 1.5x
        reason = `At steady target (${currentUsers} = ${adjustedTarget})`;
      }
    } else {
      // Other timing modes: use variance-based logic
      if (currentUsers < minUsers) {
        // Need more users, spawn faster
        spawnDelay = timingConfig.min;
        reason = `Need users (${currentUsers} < ${minUsers})`;
      } else if (currentUsers >= maxUsers) {
        // Too many users, wait longer
        spawnDelay = timingConfig.max * 2;
        reason = `At capacity (${currentUsers} >= ${maxUsers})`;
      } else {
        // Normal range, random interval
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

  private getFilteredJourneys() {
    // Handle undefined journeyPattern (fallback to mixed)
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

  private async spawnUser(): Promise<void> {
    if (!this.config.enabled) return;

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

      const activeUser: ActiveUser = {
        user,
        startTime: Date.now(),
        expectedDuration,
        currentActivity: 'arriving',
        completed: false
      };

      this.activeUsers.set(userId, activeUser);
      this.dailyStats.totalSessions++;
      this.saveDailyStats();

      console.log(`🎭 Spawned virtual user ${userId} with journey: ${journey.name} (${currentUsers + 1}/${this.config.targetConcurrentUsers} active)`);

      // Start the user journey
      this.executeUserJourney(userId, activeUser);

    } catch (error) {
      console.error('Error spawning virtual user:', error);
    }
  }

  private async executeUserJourney(userId: string, activeUser: ActiveUser): Promise<void> {
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
      await activeUser.user.executeJourney();
      
      // Check if it was a purchasing journey
      const journeyName = activeUser.user.getJourneyName?.() || '';
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

  private completeUser(userId: string): void {
    const activeUser = this.activeUsers.get(userId);
    if (!activeUser) return;

    const sessionDuration = Date.now() - activeUser.startTime;
    this.dailyStats.sessionDurations.push(sessionDuration);
    
    // Keep only recent session durations (last 100) for performance
    if (this.dailyStats.sessionDurations.length > 100) {
      this.dailyStats.sessionDurations = this.dailyStats.sessionDurations.slice(-100);
    }

    activeUser.completed = true;
    this.saveDailyStats();

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

  private cleanupCompletedUsers(): void {
    const toRemove: string[] = [];
    let completedCount = 0;
    let activeCount = 0;
    let soonToCompleteCount = 0;
    
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
        
        // Predictive spawning: check if user will complete soon
        const activeFor = Date.now() - activeUser.startTime;
        const timeRemaining = activeUser.expectedDuration - activeFor;
        
        // If user will complete within 10 seconds, count as "soon to complete"
        if (timeRemaining <= 10000 && timeRemaining > 0) {
          soonToCompleteCount++;
        }
        
        // Check for users that have been active too long (stuck)
        if (activeFor > activeUser.expectedDuration * 3) { // 3x expected duration
          console.log(`⏰ User ${userId} taking too long, marking as completed`);
          this.completeUser(userId);
        }
      }
    }

    // Predictive spawning in steady mode
    if (this.config.enabled && this.config.trafficTiming === 'steady' && soonToCompleteCount > 0) {
      const projectedActiveUsers = activeCount - soonToCompleteCount;
      if (projectedActiveUsers < this.config.targetConcurrentUsers) {
        const neededUsers = this.config.targetConcurrentUsers - projectedActiveUsers;
        console.log(`🔮 Predictive spawn: ${soonToCompleteCount} users completing soon, spawning ${neededUsers} replacements`);
        
        // Spawn replacements with small delays to avoid overwhelming
        for (let i = 0; i < neededUsers; i++) {
          setTimeout(() => {
            this.spawnUser();
          }, i * 2000); // 2 second intervals
        }
      }
    }

    toRemove.forEach(userId => {
      this.activeUsers.delete(userId);
    });

    if (toRemove.length > 0) {
      console.log(`🧹 Cleaned up ${toRemove.length} completed users (${activeCount} active, ${completedCount} completed, ${soonToCompleteCount} completing soon)`);
    }
  }

  public getStats(): TrafficStats {
    const now = Date.now();
    const activeUsersList = Array.from(this.activeUsers.values()).filter(u => !u.completed);
    
    const currentActivities = activeUsersList.map(u => u.currentActivity);
    
    const averageSessionDuration = this.dailyStats.sessionDurations.length > 0
      ? this.dailyStats.sessionDurations.reduce((a, b) => a + b, 0) / this.dailyStats.sessionDurations.length
      : 0;

    const bounceRate = this.dailyStats.totalSessions > 0
      ? this.dailyStats.sessionDurations.filter(d => d < 10000).length / this.dailyStats.totalSessions
      : this.config.bounceRate;

    return {
      activeUsers: activeUsersList.length,
      totalSessionsToday: this.dailyStats.totalSessions,
      averageSessionDuration: Math.round(averageSessionDuration / 1000), // Convert to seconds
      currentActivities,
      totalOrders: this.dailyStats.totalOrders,
      bounceRate: Math.round(bounceRate * 100) / 100
    };
  }

  public getConfig(): TrafficConfig {
    return { ...this.config };
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public updateUserActivity(userId: string, activity: string, stepIndex?: number, totalSteps?: number): void {
    const activeUser = this.activeUsers.get(userId);
    if (activeUser && !activeUser.completed) {
      // Create detailed activity string with progress
      let detailedActivity = activity;
      if (stepIndex !== undefined && totalSteps !== undefined) {
        detailedActivity = `${activity} (${stepIndex + 1}/${totalSteps})`;
      }
      
      activeUser.currentActivity = detailedActivity;
      console.log(`📍 User ${userId} activity: ${detailedActivity}`);
    }
  }

  public destroy(): void {
    this.stop();
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Force complete all active users
    this.activeUsers.forEach((activeUser, userId) => {
      if (!activeUser.completed) {
        activeUser.user.abort();
        this.completeUser(userId);
      }
    });

    TrafficManager.instance = null;
    console.log('🔄 Traffic manager destroyed');
  }
}