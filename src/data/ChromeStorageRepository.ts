import { IStorageRepository } from '../domain/repositories';
import { AppSettings, SiteStats } from '../domain/models';

export class ChromeStorageRepository implements IStorageRepository {
  private readonly STATS_KEY = 'workaround_stats';
  private readonly SETTINGS_KEY = 'workaround_settings';

  async getStats(hostname: string): Promise<SiteStats | null> {
    const allStats = await this.getAllStats();
    return allStats.find(s => s.hostname === hostname) || null;
  }

  async getAllStats(): Promise<SiteStats[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STATS_KEY], (result) => {
        const stats = (result[this.STATS_KEY] as SiteStats[]) || [];
        resolve(stats);
      });
    });
  }

  async saveStats(stats: SiteStats): Promise<void> {
    const allStats = await this.getAllStats();
    const index = allStats.findIndex(s => s.hostname === stats.hostname);
    
    if (index >= 0) {
      allStats[index] = stats;
    } else {
      allStats.push(stats);
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.STATS_KEY]: allStats }, () => {
        resolve();
      });
    });
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
}
