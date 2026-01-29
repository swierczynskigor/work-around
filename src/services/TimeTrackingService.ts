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

    // Check if it's a new day (simple logic for now, can be improved)
    // For now, we just accumulate total time forever in this simple model,
    // but typically we'd want daily stats. 
    // Let's stick to the interface: SiteStats has timeSpentMs.
    // Ideally we should reset this daily or have a daily breakdown.
    // For this MVP, let's assume timeSpentMs is "today's time" and we reset it if lastVisited was different day.
    
    // Simple day check
    const lastDate = new Date(stats.lastVisited);
    const currentDate = new Date(now);
    
    if (lastDate.toDateString() !== currentDate.toDateString()) {
      stats.timeSpentMs = 0;
    }

    stats.timeSpentMs += durationMs;
    stats.lastVisited = now;

    await this.storageRepo.saveStats(stats);
    return stats;
  }

  async getTodayStats(): Promise<SiteStats[]> {
    const allStats = await this.storageRepo.getAllStats();
    const now = new Date();
    // Filter/Reset for display if needed, but for now just return what's stored.
    // In a real app, we might want to clean up old entries here.
    return allStats.filter(s => {
       const lastDate = new Date(s.lastVisited);
       return lastDate.toDateString() === now.toDateString();
    });
  }
}
