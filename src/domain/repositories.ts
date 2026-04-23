import { AppSettings, SiteStats } from './models';

/**
 * Repository Pattern interface for accessing data.
 * Abstracts the underlying data source (e.g., Chrome Storage) from the application logic.
 */
export interface IStorageRepository {
  /**
   * Retrieves statistics for a specific hostname.
   * @param hostname The domain to query.
   * @returns SiteStats or null if not found.
   */
  getStats(hostname: string): Promise<SiteStats | null>;

  /**
   * Retrieves statistics for a specific hostname, date-aware.
   * Returns stats with timeSpentMs reset to 0 if lastVisited is before today's midnight.
   * @param hostname The domain to query.
   * @returns SiteStats with today's time only, or null if not found.
   */
  getStatsForToday(hostname: string): Promise<SiteStats | null>;

  /**
   * Retrieves statistics for all tracked sites.
   */
  getAllStats(): Promise<SiteStats[]>;

  /**
   * Retrieves statistics for all sites visited today.
   * Only returns entries where lastVisited >= today's midnight.
   */
  getAllStatsForToday(): Promise<SiteStats[]>;

  /**
   * Saves or updates statistics for a site.
   * @param stats The stats object to save.
   */
  saveStats(stats: SiteStats): Promise<void>;

  /**
   * Atomically increments time for a hostname.
   * Performs the entire read-modify-write cycle under a lock to prevent race conditions.
   * Also handles midnight reset logic.
   * @param hostname The domain to increment time for.
   * @param durationMs Duration in milliseconds to add.
   * @returns The updated SiteStats after incrementing.
   */
  incrementTime(hostname: string, durationMs: number): Promise<SiteStats>;
  
  /**
   * Loads global application settings.
   */
  getSettings(): Promise<AppSettings>;

  /**
   * Persists global application settings.
   * @param settings The new settings object.
   */
  saveSettings(settings: AppSettings): Promise<void>;
  
  /**
   * Deletes all tracked statistics.
   */
  clearAllStats(): Promise<void>;

  /**
   * Resets timeSpentMs to 0 for all entries where lastVisited is before today's midnight.
   * Prevents stale data from previous days from accumulating.
   */
  cleanupOldStats(): Promise<void>;
}
