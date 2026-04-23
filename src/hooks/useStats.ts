"use client";

import { useState, useEffect, useCallback } from 'react';
import { SiteStats, LimitRule } from '@/domain/models';

const STATS_KEY = 'workaround_stats';
const SETTINGS_KEY = 'workaround_settings';

// Helper to safely check if we're in a Chrome extension context
function isChromeExtension(): boolean {
  try {
    return typeof chrome !== 'undefined' && 
           typeof chrome.storage !== 'undefined' &&
           typeof chrome.storage.local !== 'undefined';
  } catch {
    return false;
  }
}

interface CurrentSessionInfo {
  hostname: string | null;
  currentSessionMs: number;
}

export function useStats() {
  const [stats, setStats] = useState<SiteStats[]>([]);
  const [currentHostname, setCurrentHostname] = useState<string | null>(null);
  const [currentTabStats, setCurrentTabStats] = useState<SiteStats | null>(null);
  const [currentLimit, setCurrentLimit] = useState<LimitRule | null>(null);
  const [liveSessionMs, setLiveSessionMs] = useState(0);

  // Helper to find matching limit (same logic as BlockingService)
  const findMatchingLimit = useCallback((hostname: string, limits: LimitRule[]): LimitRule | null => {
    // Exact match
    const exact = limits.find(l => l.hostname === hostname);
    if (exact) return exact;

    // Try without www prefix
    const withoutWww = hostname.replace(/^www\./, '');
    const matchWithoutWww = limits.find(l => l.hostname === withoutWww);
    if (matchWithoutWww) return matchWithoutWww;

    // Check subdomain
    for (const limit of limits) {
      if (hostname === limit.hostname || hostname.endsWith('.' + limit.hostname)) {
        return limit;
      }
    }
    
    return null;
  }, []);

  const fetchData = useCallback(async () => {
    if (!isChromeExtension()) return;

    try {
      // Get saved stats and settings
      chrome.storage.local.get([STATS_KEY], (statsResult) => {
        if (chrome.runtime.lastError) return;
        
        const allStats = (statsResult[STATS_KEY] as SiteStats[]) || [];
        
        // Filter to only today's stats (exclude stale data from previous days)
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        const todayStats = allStats.filter(s => s.lastVisited >= todayMidnight.getTime());
        
        setStats(todayStats);
        
        // Get settings for limits
        chrome.storage.sync.get([SETTINGS_KEY], (settingsResult) => {
          if (chrome.runtime.lastError) return;
          
          const settings = (settingsResult[SETTINGS_KEY] || { limits: [] }) as { limits: LimitRule[] };
          const limits = settings.limits || [];
          
          // Get current session info from background script
          if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'GET_CURRENT_SESSION' }, (response: CurrentSessionInfo) => {
              if (chrome.runtime.lastError) return;
              
              if (response && response.hostname) {
                setCurrentHostname(response.hostname);
                
                // Find saved stats and limit for this hostname
                const saved = allStats.find(s => s.hostname === response.hostname);
                const savedTimeMs = saved ? saved.timeSpentMs : 0;
                const totalTimeMs = savedTimeMs + response.currentSessionMs;
                
                setLiveSessionMs(response.currentSessionMs);
                setCurrentTabStats({
                  hostname: response.hostname,
                  timeSpentMs: totalTimeMs,
                  lastVisited: Date.now()
                });
                
                // Find matching limit
                const limit = findMatchingLimit(response.hostname, limits);
                setCurrentLimit(limit);
              } else {
                // No active session, try to get current tab info
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                  if (chrome.runtime.lastError || !tabs[0]?.url) return;
                  
                  try {
                    const url = new URL(tabs[0].url);
                    const hostname = url.hostname;
                    setCurrentHostname(hostname);
                    setLiveSessionMs(0);
                    
                    const current = allStats.find(s => s.hostname === hostname) || {
                      hostname,
                      timeSpentMs: 0,
                      lastVisited: Date.now()
                    };
                    setCurrentTabStats(current);
                    
                    // Find matching limit
                    const limit = findMatchingLimit(hostname, limits);
                    setCurrentLimit(limit);
                  } catch {
                    setCurrentHostname(null);
                    setCurrentTabStats(null);
                    setCurrentLimit(null);
                  }
                });
              }
            });
          }
        });
      });
    } catch (e) {
      console.error('[useStats] Failed to fetch stats', e);
    }
  }, [findMatchingLimit]);

  useEffect(() => {
    if (!isChromeExtension()) {
      console.warn('[useStats] Not in extension context');
      return;
    }
    
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { stats, currentTabStats, currentHostname, currentLimit, liveSessionMs };
}
