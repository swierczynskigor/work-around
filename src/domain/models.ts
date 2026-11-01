export interface SiteStats {
  hostname: string;
  favIconUrl?: string;
  timeSpentMs: number;
  lastVisited: number;
}

export interface TimeWindow {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export interface LimitRule {
  hostname: string;
  dailyLimitMs: number;
  allowedTimeWindows?: TimeWindow[];
}

export interface BudgetGroup {
  id: string;
  name: string;
  hostnames: string[];
  dailyLimitMs: number;
}

export type BlockReason =
  | "none"
  | "time_limit"
  | "outside_hours"
  | "focus_mode"
  | "youtube_shorts"
  | "entry_delay";

export interface BlockedTimeWindow extends TimeWindow {
  id: string;
  daysOfWeek: number[];
  isEnabled: boolean;
}

export interface AppSettings {
  isTrackingEnabled: boolean;
  isBlockingEnabled?: boolean;
  blockYouTubeShorts?: boolean;
  blockedWindows: BlockedTimeWindow[];
  limits: LimitRule[];
  idleSeconds?: number;
  countMedia?: boolean;
  warningsEnabled?: boolean;
  allowExtensions?: boolean;
  strictMode?: boolean;
  maxExtensionsPerDay?: number;
  groups?: BudgetGroup[];
  urlExceptions?: string[];
  entryDelaySeconds?: number;
}

export type TrackingStatus =
  | "tracking"
  | "media"
  | "disabled"
  | "manual"
  | "idle"
  | "locked"
  | "unfocused"
  | "unsupported"
  | "blocked"
  | "sleep";
export interface UsageRecord {
  id: string;
  hostname: string;
  day: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  kind: "active" | "media" | "legacy";
}
export interface TimeExtension {
  id: string;
  hostname: string;
  day: string;
  expiresAt: number;
}
export interface UsageData {
  version: 2;
  records: UsageRecord[];
  extensions: TimeExtension[];
}
export interface PolicyDecision {
  reason: BlockReason;
  remainingMs: number | null;
  usedMs: number;
  limitMs: number | null;
  budgetName: string | null;
  resetAt: number | null;
  canExtend: boolean;
  extensionUntil: number | null;
  isException: boolean;
  delaySeconds: number;
}
export interface CurrentSessionInfo {
  hostname: string | null;
  currentSessionMs: number;
  status: TrackingStatus;
  pausedUntil: number | null;
  policy: PolicyDecision | null;
}
