"use client";
import { useState, useEffect, useCallback } from "react";
import { CurrentSessionInfo, SiteStats } from "@/domain/models";
import {
  ChromeStorageRepository,
  USAGE_KEY,
} from "@/data/ChromeStorageRepository";
import { isExtension, sendCommand } from "@/data/extensionClient";
const repository = new ChromeStorageRepository();

export function useStats() {
  const [stats, setStats] = useState<SiteStats[]>([]);
  const [session, setSession] = useState<CurrentSessionInfo | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!isExtension()) return;
    try {
      const current = await sendCommand<CurrentSessionInfo>(
        "GET_CURRENT_SESSION",
      );
      const today = await repository.getAllStatsForToday();
      setSession(current);
      setStats(today);
      setError("");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to load activity.",
      );
    }
  }, []);
  useEffect(() => {
    if (!isExtension()) return;
    void Promise.resolve().then(refresh);
    const interval = setInterval(() => void refresh(), 2000);
    const changed = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[USAGE_KEY]) void refresh();
    };
    chrome.storage.onChanged.addListener(changed);
    return () => {
      clearInterval(interval);
      chrome.storage.onChanged.removeListener(changed);
    };
  }, [refresh]);
  const currentTabStats = session?.hostname
    ? stats.find((stat) => stat.hostname === session.hostname) || {
        hostname: session.hostname,
        timeSpentMs: 0,
        lastVisited: 0,
      }
    : null;
  return {
    stats,
    currentTabStats,
    currentHostname: session?.hostname || null,
    session,
    refresh,
    error,
  };
}
