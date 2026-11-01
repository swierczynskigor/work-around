import {
  AppSettings,
  PolicyDecision,
  TimeWindow,
  UsageData,
  UsageRecord,
} from "../domain/models";

export const DEFAULT_SETTINGS: AppSettings = {
  isTrackingEnabled: true,
  isBlockingEnabled: true,
  blockedWindows: [],
  limits: [],
  idleSeconds: 180,
  countMedia: false,
  warningsEnabled: true,
  allowExtensions: true,
  strictMode: false,
  maxExtensionsPerDay: 1,
  groups: [],
  urlExceptions: [],
  entryDelaySeconds: 0,
};
export const normalizeHostname = (hostname: string) =>
  hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
export function parseHostname(value: string): string {
  const url = new URL(value.includes("://") ? value : `https://${value}`);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw new Error("Enter a valid website domain.");
  return normalizeHostname(url.hostname);
}
export function hostnameFromUrl(value?: string): string | null {
  try {
    return value && /^https?:\/\//.test(value) ? parseHostname(value) : null;
  } catch {
    return null;
  }
}
export const matchesDomain = (hostname: string, domain: string) => {
  const host = normalizeHostname(hostname),
    root = normalizeHostname(domain);
  return host === root || host.endsWith(`.${root}`);
};
export function dayKey(time = Date.now()): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function nextMidnight(time: number): number {
  const date = new Date(time);
  date.setHours(24, 0, 0, 0);
  return date.getTime();
}
export function normalizeSettings(
  saved: Partial<AppSettings> = {},
): AppSettings {
  const merged = { ...DEFAULT_SETTINGS, ...saved };
  return {
    ...merged,
    // Tracking can be paused without implicitly disabling saved restrictions.
    isBlockingEnabled: saved.isBlockingEnabled ?? true,
    idleSeconds: Math.max(
      60,
      Math.min(1800, Number(merged.idleSeconds) || 180),
    ),
    entryDelaySeconds: Math.max(
      0,
      Math.min(60, Number(merged.entryDelaySeconds) || 0),
    ),
    maxExtensionsPerDay: Math.max(
      0,
      Math.min(10, Math.floor(Number(merged.maxExtensionsPerDay) || 0)),
    ),
    limits: (saved.limits || []).map((rule) => ({
      ...rule,
      hostname: normalizeHostname(rule.hostname),
    })),
    groups: (saved.groups || []).map((group) => ({
      ...group,
      hostnames: [...new Set(group.hostnames.map(normalizeHostname))],
    })),
    urlExceptions: saved.urlExceptions || [],
    blockedWindows: saved.blockedWindows || [],
  };
}
export function matchesException(value: string, exceptions: string[]): boolean {
  try {
    const current = new URL(value);
    return exceptions.some((exception) => {
      try {
        const allowed = new URL(exception);
        const path = allowed.pathname.replace(/\/$/, "");
        return (
          allowed.protocol === current.protocol &&
          normalizeHostname(allowed.hostname) ===
            normalizeHostname(current.hostname) &&
          allowed.port === current.port &&
          (current.pathname === path ||
            current.pathname.startsWith(`${path}/`)) &&
          (!allowed.search || allowed.search === current.search)
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
export function inTimeWindow(window: TimeWindow, time: number): boolean {
  const date = new Date(time),
    minutes = date.getHours() * 60 + date.getMinutes();
  const start = window.startHour * 60 + window.startMinute,
    end = window.endHour * 60 + window.endMinute;
  return start <= end
    ? minutes >= start && minutes < end
    : minutes >= start || minutes < end;
}
export function isFocusBlocked(settings: AppSettings, time: number): boolean {
  return settings.blockedWindows.some((window) => {
    if (!window.isEnabled || !inTimeWindow(window, time)) return false;
    const date = new Date(time),
      minutes = date.getHours() * 60 + date.getMinutes();
    const overnight =
      window.startHour * 60 + window.startMinute >
      window.endHour * 60 + window.endMinute;
    // After midnight, the window belongs to the day on which it started.
    const day =
      overnight && minutes < window.endHour * 60 + window.endMinute
        ? (date.getDay() + 6) % 7
        : date.getDay();
    return window.daysOfWeek.includes(day);
  });
}
export function usageForDomains(
  records: UsageRecord[],
  domains: string[],
  day: string,
): number {
  const matching = records.filter(
    (record) =>
      record.day === day &&
      domains.some((domain) => matchesDomain(record.hostname, domain)),
  );
  const intervals = matching
    .filter((record) => record.kind !== "legacy")
    .map((record) => [record.startedAt, record.endedAt])
    .sort((a, b) => a[0] - b[0]);
  let total = matching
    .filter((record) => record.kind === "legacy")
    .reduce((sum, record) => sum + record.durationMs, 0);
  let end = 0;
  for (const [start, stop] of intervals) {
    total += Math.max(0, stop - Math.max(start, end));
    end = Math.max(end, stop);
  }
  return total;
}
export function evaluatePolicy(
  url: string,
  settings: AppSettings,
  data: UsageData,
  now = Date.now(),
): PolicyDecision {
  const result: PolicyDecision = {
    reason: "none",
    remainingMs: null,
    usedMs: 0,
    limitMs: null,
    budgetName: null,
    resetAt: null,
    canExtend: false,
    pinRequired: false,
    extensionUntil: null,
    isException: false,
    delaySeconds: 0,
  };
  const hostname = hostnameFromUrl(url);
  if (!hostname) return result;
  result.isException = matchesException(url, settings.urlExceptions || []);
  if (settings.isBlockingEnabled === false || result.isException) return result;
  const parsed = new URL(url);
  if (
    settings.blockYouTubeShorts &&
    matchesDomain(hostname, "youtube.com") &&
    /^\/shorts(?:\/|$)/.test(parsed.pathname)
  )
    result.reason = "youtube_shorts";
  else if (isFocusBlocked(settings, now)) result.reason = "focus_mode";
  const limit = [...settings.limits]
    .sort((a, b) => b.hostname.length - a.hostname.length)
    .find((rule) => matchesDomain(hostname, rule.hostname));
  if (
    result.reason === "none" &&
    limit?.allowedTimeWindows?.length &&
    !limit.allowedTimeWindows.some((window) => inTimeWindow(window, now))
  )
    result.reason = "outside_hours";
  const day = dayKey(now);
  const budgets = [
    ...(limit
      ? [
          {
            name: limit.hostname,
            domains: [limit.hostname],
            ms: limit.dailyLimitMs,
          },
        ]
      : []),
    ...(settings.groups || [])
      .filter((group) =>
        group.hostnames.some((domain) => matchesDomain(hostname, domain)),
      )
      .map((group) => ({
        name: group.name,
        domains: group.hostnames,
        ms: group.dailyLimitMs,
      })),
  ];
  for (const budget of budgets) {
    const used = usageForDomains(data.records, budget.domains, day),
      remaining = Math.max(0, budget.ms - used);
    if (result.remainingMs === null || remaining < result.remainingMs) {
      Object.assign(result, {
        remainingMs: remaining,
        usedMs: used,
        limitMs: budget.ms,
        budgetName: budget.name,
        resetAt: nextMidnight(now),
      });
    }
  }
  const extension =
    settings.allowExtensions &&
    !settings.strictMode &&
    data.extensions.find(
      (item) =>
        item.day === day && item.hostname === hostname && item.expiresAt > now,
    );
  if (result.reason === "none" && result.remainingMs === 0) {
    if (extension) {
      result.extensionUntil = extension.expiresAt;
      result.remainingMs = extension.expiresAt - now;
    } else result.reason = "time_limit";
  }
  result.canExtend =
    result.reason === "time_limit" &&
    !!settings.allowExtensions &&
    !settings.strictMode &&
    data.extensions.filter((item) => item.day === day).length <
      (settings.maxExtensionsPerDay ?? 1);
  if (result.reason === "outside_hours" || result.reason === "focus_mode") {
    result.resetAt = null;
    const firstMinute = Math.floor(now / 60_000) * 60_000 + 60_000;
    for (let time = firstMinute; time <= now + 8 * 86_400_000; time += 60_000) {
      const allowedHours =
        !limit?.allowedTimeWindows?.length ||
        limit.allowedTimeWindows.some((window) => inTimeWindow(window, time));
      const availableBudget = result.remainingMs !== 0 || dayKey(time) !== day;
      if (allowedHours && availableBudget && !isFocusBlocked(settings, time)) {
        result.resetAt = time;
        break;
      }
    }
  }
  result.delaySeconds = budgets.length ? settings.entryDelaySeconds || 0 : 0;
  return result;
}
