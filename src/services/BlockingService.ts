import { IBlockingService } from '../domain/services';
import { IStorageRepository } from '../domain/repositories';
import { AppSettings, LimitRule, TimeWindow, BlockReason } from '../domain/models';

export class BlockingService implements IBlockingService {
  constructor(private storageRepo: IStorageRepository) {}

  /**
   * Checks if hostname matches a limit rule.
   * Handles subdomain matching (www.facebook.com matches facebook.com rule)
   */
  private findMatchingLimit(hostname: string, limits: LimitRule[]): LimitRule | undefined {
    // First try exact match
    const exact = limits.find(l => l.hostname === hostname);
    if (exact) return exact;

    // Try without www prefix
    const withoutWww = hostname.replace(/^www\./, '');
    const matchWithoutWww = limits.find(l => l.hostname === withoutWww);
    if (matchWithoutWww) return matchWithoutWww;

    // Check if hostname ends with any limit domain (for subdomains)
    for (const limit of limits) {
      if (hostname === limit.hostname || hostname.endsWith('.' + limit.hostname)) {
        return limit;
      }
    }
    
    return undefined;
  }

  async isBlocked(hostname: string): Promise<boolean> {
    const reason = await this.getBlockReason(hostname);
    return reason !== 'none';
  }

  /**
   * Get the reason why a site is blocked.
   * Returns 'none' if not blocked.
   */
  async getBlockReason(hostname: string): Promise<BlockReason> {
    const settings = await this.storageRepo.getSettings();
    if (!settings.isTrackingEnabled) return 'none';

    // 1. Check Daily Limits
    const limitRule = this.findMatchingLimit(hostname, settings.limits);
    if (limitRule) {
      // Check if outside allowed time windows
      if (limitRule.allowedTimeWindows && limitRule.allowedTimeWindows.length > 0) {
        if (!this.isInAnyAllowedTimeWindow(limitRule.allowedTimeWindows)) {
          return 'outside_hours';
        }
      }

      // Check if daily limit exceeded
      const stats = await this.storageRepo.getStats(hostname);
      if (stats && stats.timeSpentMs >= limitRule.dailyLimitMs) {
        return 'time_limit';
      }
    }

    // 2. Check Global Blocked Windows (Focus Mode)
    if (this.isInBlockedWindow(settings)) {
      return 'focus_mode';
    }

    return 'none';
  }

  /**
   * Check if current time is within ANY of the allowed time windows.
   * Returns true if access is allowed, false if blocked.
   */
  private isInAnyAllowedTimeWindow(windows: TimeWindow[]): boolean {
    return windows.some(window => this.isInTimeWindow(window));
  }

  /**
   * Check if current time is within a specific time window.
   */
  private isInTimeWindow(window: TimeWindow): boolean {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = window.startHour * 60 + window.startMinute;
    const endMinutes = window.endHour * 60 + window.endMinute;

    if (startMinutes <= endMinutes) {
      // Normal window (e.g., 16:00 - 23:00)
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Overnight window (e.g., 23:00 - 07:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  async getRemainingTime(hostname: string): Promise<number> {
    const settings = await this.storageRepo.getSettings();
    const limitRule = this.findMatchingLimit(hostname, settings.limits);
    
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
