/**
 * Represents statistics for a single visited site.
 */
export interface SiteStats {
  /** The domain name of the site (e.g., "google.com") */
  hostname: string;
  /** URL to the favicon of the site */
  favIconUrl?: string;
  /** Total time spent on this site in milliseconds */
  timeSpentMs: number;
  /** Timestamp of the last visit (Date.now()) */
  lastVisited: number; // timestamp
}

/**
 * Defines a time limit rule for a specific domain.
 */
export interface LimitRule {
  /** The domain to limit */
  hostname: string;
  /** Maximum allowed time per day in milliseconds */
  dailyLimitMs: number;
}

/**
 * Defines a recurring time window when access should be blocked entirely.
 * Useful for "Focus Hours".
 */
export interface BlockedTimeWindow {
  id: string;
  startHour: number; // 0-23
  startMinute: number; // 0-59
  endHour: number;
  endMinute: number;
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, etc.
  isEnabled: boolean;
}

/**
 * Global application settings stored in Chrome Storage.
 */
export interface AppSettings {
  /** Whether time tracking is globally active */
  isTrackingEnabled: boolean;
  /** List of scheduled blocking windows */
  blockedWindows: BlockedTimeWindow[];
  /** List of daily usage limits per site */
  limits: LimitRule[];
}
