import { ITimeTrackingService } from '../domain/services';
import { IStorageRepository } from '../domain/repositories';
import { SiteStats } from '../domain/models';

export class TimeTrackingService implements ITimeTrackingService {
  constructor(private storageRepo: IStorageRepository) {}

  async trackTime(hostname: string, durationMs: number): Promise<SiteStats> {
    // Delegate to the repository's atomic increment to prevent race conditions
    // where concurrent calls could overwrite each other's time increments.
    return await this.storageRepo.incrementTime(hostname, durationMs);
  }

  async getTodayStats(): Promise<SiteStats[]> {
    return await this.storageRepo.getAllStatsForToday();
  }
}
