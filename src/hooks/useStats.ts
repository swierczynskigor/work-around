"use client";

import { useState, useEffect, useCallback } from 'react';
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

interface CurrentSessionInfo {
  hostname: string | null;
  currentSessionMs: number;
}

export function useStats() {
  const [stats, setStats] = useState<SiteStats[]>([]);
  const [currentHostname, setCurrentHostname] = useState<string | null>(null);
  const [currentTabStats, setCurrentTabStats] = useState<SiteStats | null>(null);
  const [liveSessionMs, setLiveSessionMs] = useState(0);

  const fetchData = useCallback(async () => {
    if (!isChromeExtension()) return;

    try {
      // Get saved stats from storage
      chrome.storage.local.get([STATS_KEY], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[useStats] Chrome storage error:', chrome.runtime.lastError);
          return;
        }
        
        const allStats = (result[STATS_KEY] as SiteStats[]) || [];
        setStats(allStats);
        
        // Get current session info from background script (for live updates)
        if (chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: 'GET_CURRENT_SESSION' }, (response: CurrentSessionInfo) => {
            if (chrome.runtime.lastError) {
              // Background might not be ready yet
              return;
            }
            
            if (response && response.hostname) {
              setCurrentHostname(response.hostname);
              
              // Find saved stats for this hostname
              const saved = allStats.find(s => s.hostname === response.hostname);
              const savedTimeMs = saved ? saved.timeSpentMs : 0;
              
              // Add live session time to saved time
              const totalTimeMs = savedTimeMs + response.currentSessionMs;
              setLiveSessionMs(response.currentSessionMs);
              
              setCurrentTabStats({
                hostname: response.hostname,
                timeSpentMs: totalTimeMs,
                lastVisited: Date.now()
              });
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
                } catch {
                  setCurrentHostname(null);
                  setCurrentTabStats(null);
                }
              });
            }
          });
        }
      });
    } catch (e) {
      console.error('[useStats] Failed to fetch stats', e);
    }
  }, []);

  useEffect(() => {
    console.log('[useStats] Hook mounted');
    
    if (!isChromeExtension()) {
      console.warn('[useStats] Not in extension context');
      return;
    }
    
    fetchData();
    const interval = setInterval(fetchData, 1000); // Poll every second for live updates
    return () => clearInterval(interval);
  }, [fetchData]);

  return { stats, currentTabStats, currentHostname, liveSessionMs };
}
