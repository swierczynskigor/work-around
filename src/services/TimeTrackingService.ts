import { ITimeTrackingService } from '../domain/services';
import { IStorageRepository } from '../domain/repositories';
import { SiteStats } from '../domain/models';

export class TimeTrackingService implements ITimeTrackingService {
  constructor(private storageRepo: IStorageRepository) {}

  async trackTime(hostname: string, durationMs: number): Promise<SiteStats> {
    let stats = await this.storageRepo.getStats(hostname);
    const now = Date.now();

    if (!stats) {
      stats = {
        hostname,
        timeSpentMs: 0,
        lastVisited: now,
      };
    }

    // Check if it's a new day using midnight timestamp comparison
    // This is more reliable than toDateString() for timezone handling
    const lastMidnight = new Date(stats.lastVisited);
    lastMidnight.setHours(0, 0, 0, 0);

    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);

    if (lastMidnight.getTime() < todayMidnight.getTime()) {
      stats.timeSpentMs = 0;
    }

    stats.timeSpentMs += durationMs;
    stats.lastVisited = now;

    await this.storageRepo.saveStats(stats);
    return stats;
  }

  async getTodayStats(): Promise<SiteStats[]> {
    const allStats = await this.storageRepo.getAllStats();
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    
    // Only return stats from today (lastVisited >= today's midnight)
    return allStats.filter(s => s.lastVisited >= todayMidnight.getTime());
  }
}
