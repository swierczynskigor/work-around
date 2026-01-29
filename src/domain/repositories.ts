import { AppSettings, SiteStats } from './models';

export interface IStorageRepository {
  getStats(hostname: string): Promise<SiteStats | null>;
  getAllStats(): Promise<SiteStats[]>;
  saveStats(stats: SiteStats): Promise<void>;
  
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  
  clearAllStats(): Promise<void>;
}
