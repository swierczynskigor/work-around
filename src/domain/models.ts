export interface SiteStats {
  hostname: string;
  favIconUrl?: string;
  timeSpentMs: number;
  lastVisited: number; // timestamp
}

export interface LimitRule {
  hostname: string;
  dailyLimitMs: number;
}

export interface BlockedTimeWindow {
  id: string;
  startHour: number; // 0-23
  startMinute: number; // 0-59
  endHour: number;
  endMinute: number;
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, etc.
  isEnabled: boolean;
}

export interface AppSettings {
  isTrackingEnabled: boolean;
  blockedWindows: BlockedTimeWindow[];
  limits: LimitRule[];
}
