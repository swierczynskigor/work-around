import { IBlockingService } from '../domain/services';
import { IStorageRepository } from '../domain/repositories';
import { AppSettings, SiteStats } from '../domain/models';

export class BlockingService implements IBlockingService {
  constructor(private storageRepo: IStorageRepository) {}

  async isBlocked(hostname: string): Promise<boolean> {
    const settings = await this.storageRepo.getSettings();
    if (!settings.isTrackingEnabled) return false;

    // 1. Check Daily Limits
    const limitRule = settings.limits.find(l => l.hostname === hostname);
    if (limitRule) {
      const stats = await this.storageRepo.getStats(hostname);
      if (stats && stats.timeSpentMs >= limitRule.dailyLimitMs) {
        return true;
      }
    }

    // 2. Check Time Windows (Simplified for now, assuming window applies to ALL sites or logic)
    // The current model puts windows in global settings, so they block everything? 
    // Or maybe we treat them as "Focus Mode" windows.
    // Let's assume they block everything for now based on the model.
    if (this.isInBlockedWindow(settings)) {
        return true;
    }

    return false;
  }

  async getRemainingTime(hostname: string): Promise<number> {
    const settings = await this.storageRepo.getSettings();
    const limitRule = settings.limits.find(l => l.hostname === hostname);
    
    if (!limitRule) return -1;

    const stats = await this.storageRepo.getStats(hostname);
    const timeSpent = stats ? stats.timeSpentMs : 0;
    
    return Math.max(0, limitRule.dailyLimitMs - timeSpent);
  }

  private isInBlockedWindow(settings: AppSettings): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay(); // 0-6

    return settings.blockedWindows.some(window => {
      if (!window.isEnabled) return false;
      if (!window.daysOfWeek.includes(currentDay)) return false;

      const start = window.startHour * 60 + window.startMinute;
      const end = window.endHour * 60 + window.endMinute;
      const current = currentHour * 60 + currentMinute;

      if (start <= end) {
        return current >= start && current < end;
      } else {
        // Overnight window (e.g. 23:00 - 07:00)
        return current >= start || current < end;
      }
    });
  }
}
