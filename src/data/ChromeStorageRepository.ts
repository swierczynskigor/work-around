import { IStorageRepository } from "../domain/repositories";
import {
  AppSettings,
  SiteStats,
  UsageData,
  UsageRecord,
} from "../domain/models";
import {
  dayKey,
  normalizeHostname,
  normalizeSettings,
} from "../services/policies";

export const USAGE_KEY = "workaround_usage_v2";
export const SETTINGS_KEY = "workaround_settings";
export const SESSION_KEY = "workaround_activity_v2";
const emptyUsage = (): UsageData => ({
  version: 2,
  records: [],
  extensions: [],
});

/** All usage mutations are dispatched to the background worker, the single writer. */
export class ChromeStorageRepository implements IStorageRepository {
  private queue: Promise<unknown> = Promise.resolve();
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation);
    this.queue = next.catch(() => undefined);
    return next;
  }
  async getUsage(): Promise<UsageData> {
    const result = await chrome.storage.local.get(USAGE_KEY);
    return (result[USAGE_KEY] as UsageData) || emptyUsage();
  }
  async migrate(): Promise<void> {
    await this.serialize(async () => {
      const stored = await chrome.storage.local.get([
        USAGE_KEY,
        "workaround_stats",
      ]);
      if (stored[USAGE_KEY]) return;
      const merged = new Map<string, SiteStats>();
      for (const stat of (stored.workaround_stats || []) as SiteStats[]) {
        const hostname = normalizeHostname(stat.hostname),
          key = `${dayKey(stat.lastVisited)}:${hostname}`;
        const old = merged.get(key);
        if (!old || old.timeSpentMs < stat.timeSpentMs)
          merged.set(key, { ...stat, hostname });
      }
      const records: UsageRecord[] = [...merged.values()]
        .filter((stat) => stat.timeSpentMs > 0)
        .map((stat) => ({
          id: crypto.randomUUID(),
          hostname: stat.hostname,
          day: dayKey(stat.lastVisited),
          kind: "legacy",
          startedAt: stat.lastVisited,
          endedAt: stat.lastVisited,
          durationMs: stat.timeSpentMs,
        }));
      await chrome.storage.local.set({
        [USAGE_KEY]: { ...emptyUsage(), records },
      });
    });
  }
  async mutateUsage<T>(operation: (data: UsageData) => T): Promise<T> {
    return this.serialize(async () => {
      const data = await this.getUsage(),
        value = operation(data);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 29);
      cutoff.setHours(0, 0, 0, 0);
      data.records = data.records.filter(
        (record) => record.day >= dayKey(cutoff.getTime()),
      );
      data.extensions = data.extensions.filter((item) => item.day === dayKey());
      await chrome.storage.local.set({ [USAGE_KEY]: data });
      return value;
    });
  }
  async appendIntervals(intervals: Omit<UsageRecord, "id">[]): Promise<void> {
    if (!intervals.length) return;
    await this.mutateUsage((data) => {
      for (const interval of intervals) {
        const last = [...data.records]
          .reverse()
          .find((record) => record.hostname === interval.hostname);
        if (
          last &&
          last.kind === interval.kind &&
          last.day === interval.day &&
          last.endedAt === interval.startedAt
        ) {
          last.endedAt = interval.endedAt;
          last.durationMs += interval.durationMs;
        } else data.records.push({ ...interval, id: crypto.randomUUID() });
      }
    });
  }
  async getAllStats(): Promise<SiteStats[]> {
    return this.getAllStatsForToday();
  }
  async getAllStatsForToday(): Promise<SiteStats[]> {
    const data = await this.getUsage(),
      stats = new Map<string, SiteStats>();
    for (const record of data.records.filter(
      (record) => record.day === dayKey(),
    )) {
      const old = stats.get(record.hostname) || {
        hostname: record.hostname,
        timeSpentMs: 0,
        lastVisited: 0,
      };
      old.timeSpentMs += record.durationMs;
      old.lastVisited = Math.max(old.lastVisited, record.endedAt);
      stats.set(record.hostname, old);
    }
    return [...stats.values()];
  }
  async getStats(hostname: string): Promise<SiteStats | null> {
    return (
      (await this.getAllStatsForToday()).find(
        (stat) => stat.hostname === normalizeHostname(hostname),
      ) || null
    );
  }
  async getStatsForToday(hostname: string): Promise<SiteStats | null> {
    return this.getStats(hostname);
  }
  async saveStats(stats: SiteStats): Promise<void> {
    await this.mutateUsage((data) => {
      data.records = data.records.filter(
        (record) =>
          record.hostname !== normalizeHostname(stats.hostname) ||
          record.day !== dayKey(),
      );
      if (stats.timeSpentMs > 0)
        data.records.push({
          id: crypto.randomUUID(),
          hostname: normalizeHostname(stats.hostname),
          day: dayKey(),
          startedAt: stats.lastVisited,
          endedAt: stats.lastVisited,
          durationMs: stats.timeSpentMs,
          kind: "legacy",
        });
    });
  }
  async incrementTime(
    hostname: string,
    durationMs: number,
  ): Promise<SiteStats> {
    if (!Number.isFinite(durationMs) || durationMs <= 0)
      throw new Error("Invalid duration");
    const now = Date.now();
    await this.appendIntervals([
      {
        hostname: normalizeHostname(hostname),
        startedAt: now - durationMs,
        endedAt: now,
        durationMs,
        kind: "active",
        day: dayKey(now),
      },
    ]);
    return (await this.getStats(hostname))!;
  }
  async getSettings(): Promise<AppSettings> {
    const result = await chrome.storage.sync.get(SETTINGS_KEY);
    return normalizeSettings(
      result[SETTINGS_KEY] as Partial<AppSettings> | undefined,
    );
  }
  async saveSettings(settings: AppSettings): Promise<void> {
    await chrome.storage.sync.set({
      [SETTINGS_KEY]: normalizeSettings(settings),
    });
  }
  async clearAllStats(): Promise<void> {
    await this.mutateUsage((data) => {
      data.records = [];
    });
  }
  async cleanupOldStats(): Promise<void> {
    await this.mutateUsage(() => undefined);
  }
  async getPreferences(): Promise<{
    language?: import("../lib/i18n").Language;
    theme?: "light" | "dark" | "system";
  }> {
    const result = await chrome.storage.sync.get([
      "workaround_language",
      "workaround_theme",
    ]);
    return {
      language: result.workaround_language as
        import("../lib/i18n").Language | undefined,
      theme: result.workaround_theme as "light" | "dark" | "system" | undefined,
    };
  }
  async savePreferences(value: {
    language?: string;
    theme?: string;
  }): Promise<void> {
    await chrome.storage.sync.set({
      ...(value.language ? { workaround_language: value.language } : {}),
      ...(value.theme ? { workaround_theme: value.theme } : {}),
    });
  }
  async getSession<T>(): Promise<T | undefined> {
    return (await chrome.storage.session.get(SESSION_KEY))[SESSION_KEY] as
      T | undefined;
  }
  async saveSession(value: unknown): Promise<void> {
    await chrome.storage.session.set({ [SESSION_KEY]: value });
  }
}
