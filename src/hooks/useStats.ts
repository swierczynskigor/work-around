"use client";

import { useState, useEffect } from 'react';
import { ChromeStorageRepository } from '@/data/ChromeStorageRepository';
import { SiteStats } from '@/domain/models';

export function useStats() {
  const [stats, setStats] = useState<SiteStats[]>([]);
  const [currentHostname, setCurrentHostname] = useState<string | null>(null);
  const [currentTabStats, setCurrentTabStats] = useState<SiteStats | null>(null);

  useEffect(() => {
    // Only run in browser environment where chrome is defined
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    const repo = new ChromeStorageRepository();
    
    const fetch = async () => {
      try {
        const all = await repo.getAllStats();
        setStats(all);
        
        // Get current tab info
        if (chrome.tabs) {
           const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
           if (tab && tab.url) {
              try {
                const url = new URL(tab.url);
                const hostname = url.hostname;
                setCurrentHostname(hostname);
                
                const current = all.find(s => s.hostname === hostname) || {
                    hostname,
                    timeSpentMs: 0,
                    lastVisited: Date.now()
                };
                setCurrentTabStats(current);
              } catch (e) {
                // Invalid URL
              }
           }
        }
      } catch (e) {
        console.error("Failed to fetch stats", e);
      }
    };
    
    fetch();
    const interval = setInterval(fetch, 1000); // Polling for live updates
    return () => clearInterval(interval);
  }, []);

  return { stats, currentTabStats, currentHostname };
}
