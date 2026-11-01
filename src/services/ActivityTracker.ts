import { UsageRecord } from "../domain/models";
import { dayKey, nextMidnight } from "./policies";

export interface ActivityTarget {
  hostname: string;
  kind: "active" | "media";
}
export const MAX_SAMPLE_GAP_MS = 12_000;

/** Only consecutive, observed samples count. Never reconstruct an unattended gap. */
export class ActivityTracker {
  private previous: { at: number; targets: ActivityTarget[] } | null = null;
  sample(
    at: number,
    targets: ActivityTarget[],
    closePrevious = false,
  ): Omit<UsageRecord, "id">[] {
    const previous = this.previous;
    const unique = new Map<string, ActivityTarget>();
    for (const target of targets)
      if (!unique.has(target.hostname) || target.kind === "active")
        unique.set(target.hostname, target);
    this.previous = { at, targets: [...unique.values()] };
    if (!previous || at <= previous.at || at - previous.at > MAX_SAMPLE_GAP_MS)
      return [];
    const intervals: Omit<UsageRecord, "id">[] = [];
    for (const target of previous.targets) {
      if (
        !closePrevious &&
        !targets.some((current) => current.hostname === target.hostname)
      )
        continue;
      let start = previous.at;
      while (start < at) {
        const end = Math.min(at, nextMidnight(start));
        intervals.push({
          hostname: target.hostname,
          kind: target.kind,
          day: dayKey(start),
          startedAt: start,
          endedAt: end,
          durationMs: end - start,
        });
        start = end;
      }
    }
    return intervals;
  }
  reset(): void {
    this.previous = null;
  }
}
