"use client";

import { useState, useEffect } from 'react';
import { SiteStats } from '@/domain/models';

const STATS_KEY = 'workaround_stats';

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

export function useStats() {
  const [stats, setStats] = useState<SiteStats[]>([]);
  const [currentHostname, setCurrentHostname] = useState<string | null>(null);
  const [currentTabStats, setCurrentTabStats] = useState<SiteStats | null>(null);

  useEffect(() => {
    console.log('[useStats] Hook mounted, checking environment...');
    
    if (!isChromeExtension()) {
      console.warn('[useStats] Not in extension context');
      return;
    }

    const fetchStats = async () => {
      try {
        // Get all stats
        chrome.storage.local.get([STATS_KEY], (result) => {
          if (chrome.runtime.lastError) {
            console.error('[useStats] Chrome storage error:', chrome.runtime.lastError);
            return;
          }
          
          const allStats = (result[STATS_KEY] as SiteStats[]) || [];
          setStats(allStats);
          
          // Get current tab info
          if (chrome.tabs) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (chrome.runtime.lastError) {
                console.error('[useStats] Tabs query error:', chrome.runtime.lastError);
                return;
              }
              
              const tab = tabs[0];
              if (tab && tab.url) {
                try {
                  const url = new URL(tab.url);
                  const hostname = url.hostname;
                  setCurrentHostname(hostname);
                  
                  const current = allStats.find(s => s.hostname === hostname) || {
                    hostname,
                    timeSpentMs: 0,
                    lastVisited: Date.now()
                  };
                  setCurrentTabStats(current);
                } catch (e) {
                  // Invalid URL (e.g. chrome://)
                  console.log('[useStats] Invalid URL', tab.url);
                  setCurrentHostname(null);
                  setCurrentTabStats(null);
                }
              }
            });
          }
        });
      } catch (e) {
        console.error('[useStats] Failed to fetch stats', e);
      }
    };
    
    fetchStats();
    const interval = setInterval(fetchStats, 2000); // Polling for live updates (less aggressive)
    return () => clearInterval(interval);
  }, []);

  return { stats, currentTabStats, currentHostname };
}
