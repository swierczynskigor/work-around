import { IStorageRepository } from '../domain/repositories';
import { AppSettings, SiteStats } from '../domain/models';

function getTodayMidnight(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export class ChromeStorageRepository implements IStorageRepository {
  private readonly STATS_KEY = 'workaround_stats';
  private readonly SETTINGS_KEY = 'workaround_settings';
  
  // Lock to prevent race conditions during save
  private saveLock: Promise<void> = Promise.resolve();

  async getStats(hostname: string): Promise<SiteStats | null> {
    const allStats = await this.getAllStats();
    return allStats.find(s => s.hostname === hostname) ?? null;
  }

  async getAllStats(): Promise<SiteStats[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STATS_KEY], (result) => {
        const stats = (result[this.STATS_KEY] as SiteStats[]) || [];
        resolve(stats);
      });
    });
  }

  async getStatsForToday(hostname: string): Promise<SiteStats | null> {
    const stats = await this.getStats(hostname);
    if (!stats) return null;

    if (stats.lastVisited < getTodayMidnight()) {
      // Entry is from a previous day — treat as zero time today
      return { ...stats, timeSpentMs: 0 };
    }
    return stats;
  }

  async getAllStatsForToday(): Promise<SiteStats[]> {
    const allStats = await this.getAllStats();
    const todayMidnight = getTodayMidnight();
    return allStats.filter(s => s.lastVisited >= todayMidnight);
  }

  async saveStats(stats: SiteStats): Promise<void> {
    // Queue this save operation after any pending saves
    this.saveLock = this.saveLock.then(async () => {
      // Re-read latest stats to avoid race conditions
      const allStats = await this.getAllStats();
      const index = allStats.findIndex(s => s.hostname === stats.hostname);
      
      if (index >= 0) {
        // CRITICAL: Merge with existing data, don't just overwrite!
        // The incoming stats.timeSpentMs should be the increment, not total
        // But since TimeTrackingService already does the math, we just save it
        allStats[index] = stats;
      } else {
        allStats.push(stats);
      }

      return new Promise<void>((resolve) => {
        chrome.storage.local.set({ [this.STATS_KEY]: allStats }, () => {
          console.log(`[Storage] Saved ${stats.hostname}: ${stats.timeSpentMs}ms`);
          resolve();
        });
      });
    });
    
    return this.saveLock;
  }

  async getSettings(): Promise<AppSettings> {
    return new Promise((resolve) => {
      chrome.storage.sync.get([this.SETTINGS_KEY], (result) => {
        const defaultSettings: AppSettings = {
          isTrackingEnabled: true,
          blockedWindows: [],
          limits: []
        };
        const settings = (result[this.SETTINGS_KEY] as AppSettings) || defaultSettings;
        resolve(settings);
      });
    });
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [this.SETTINGS_KEY]: settings }, () => {
        resolve();
      });
    });
  }

  async clearAllStats(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove([this.STATS_KEY], () => {
        resolve();
      });
    });
  }

  async cleanupOldStats(): Promise<void> {
    this.saveLock = this.saveLock.then(async () => {
      const allStats = await this.getAllStats();
      const todayMidnight = getTodayMidnight();
      let changed = false;

      for (const stat of allStats) {
        if (stat.lastVisited < todayMidnight && stat.timeSpentMs > 0) {
          stat.timeSpentMs = 0;
          changed = true;
        }
      }

      if (changed) {
        await new Promise<void>((res) => {
          chrome.storage.local.set({ [this.STATS_KEY]: allStats }, () => {
            console.log('[Storage] Cleaned up old stats — reset stale entries to 0');
            res();
          });
        });
      }
    });
    return this.saveLock;
  }

  async incrementTime(hostname: string, durationMs: number): Promise<SiteStats> {
    return new Promise<SiteStats>((resolve) => {
      // Queue behind any pending save operations for atomicity
      this.saveLock = this.saveLock.then(async () => {
        const allStats = await this.getAllStats();
        let stats = allStats.find(s => s.hostname === hostname);
        const now = Date.now();

        if (!stats) {
          stats = {
            hostname,
            timeSpentMs: 0,
            lastVisited: now,
          };
          allStats.push(stats);
        }

        // Check if it's a new day — reset time if midnight has passed
        const lastMidnight = new Date(stats.lastVisited);
        lastMidnight.setHours(0, 0, 0, 0);
        const todayMidnight = new Date(now);
        todayMidnight.setHours(0, 0, 0, 0);

        if (lastMidnight.getTime() < todayMidnight.getTime()) {
          stats.timeSpentMs = 0;
        }

        stats.timeSpentMs += durationMs;
        stats.lastVisited = now;

        // Update in the array
        const index = allStats.findIndex(s => s.hostname === hostname);
        if (index >= 0) {
          allStats[index] = stats;
        }

        await new Promise<void>((res) => {
          chrome.storage.local.set({ [this.STATS_KEY]: allStats }, () => {
            console.log(`[Storage] Incremented ${hostname}: +${durationMs}ms → ${stats!.timeSpentMs}ms`);
            res();
          });
        });

        resolve(stats);
      });
    });
  }
}
