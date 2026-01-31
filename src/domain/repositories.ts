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
   * Retrieves statistics for all tracked sites.
   */
  getAllStats(): Promise<SiteStats[]>;

  /**
   * Saves or updates statistics for a site.
   * @param stats The stats object to save.
   */
  saveStats(stats: SiteStats): Promise<void>;
  
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
}
