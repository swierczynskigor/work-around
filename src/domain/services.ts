import { SiteStats } from './models';

export interface ITimeTrackingService {
  trackTime(hostname: string, durationMs: number): Promise<SiteStats>;
  getTodayStats(): Promise<SiteStats[]>;
}

export interface IBlockingService {
  isBlocked(hostname: string): Promise<boolean>;
  getRemainingTime(hostname: string): Promise<number>; // -1 if no limit
}
