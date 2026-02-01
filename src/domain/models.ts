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
  /** 
   * Optional: Time window when access is allowed.
   * If set, the site is only accessible during this window.
   * Example: { startHour: 16, startMinute: 0, endHour: 23, endMinute: 0 }
   * means YouTube only after 4pm
   */
  allowedTimeWindow?: {
    startHour: number;   // 0-23
    startMinute: number; // 0-59
    endHour: number;     // 0-23
    endMinute: number;   // 0-59
  };
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
