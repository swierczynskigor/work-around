import { SiteStats } from './models';

/**
 * Service responsible for tracking user activity.
 * Handles the logic of accumulating time.
 */
export interface ITimeTrackingService {
  /**
   * Adds duration to the stats for a hostname.
   * @param hostname The active domain.
   * @param durationMs Duration in milliseconds to add.
   */
  trackTime(hostname: string, durationMs: number): Promise<SiteStats>;

  /**
   * Returns stats relevant for "Today".
   * (Current implementation might just be all stats, but interface allows filtering).
   */
  getTodayStats(): Promise<SiteStats[]>;
}

/**
 * Service responsible for enforcing limits and blocking policies.
 */
export interface IBlockingService {
  /**
   * Checks if the user is currently allowed to access the site.
   * Considers daily limits and blocked windows.
   * @param hostname The domain to check.
   */
  isBlocked(hostname: string): Promise<boolean>;

  /**
   * Calculates remaining time for a hostname today.
   * @param hostname The domain to check.
   * @returns Remaining milliseconds, or -1 if no limit exists.
   */
  getRemainingTime(hostname: string): Promise<number>; // -1 if no limit
}
