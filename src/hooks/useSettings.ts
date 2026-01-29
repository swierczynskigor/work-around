"use client";

import { useState, useEffect } from 'react';
import { ChromeStorageRepository } from '@/data/ChromeStorageRepository';
import { AppSettings, BlockedTimeWindow, LimitRule } from '@/domain/models';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only run in browser environment where chrome is defined
    if (typeof chrome === 'undefined' || !chrome.storage) {
        setLoading(false);
        return;
    }

    const repo = new ChromeStorageRepository();
    repo.getSettings().then(s => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const saveSettings = async (newSettings: AppSettings) => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const repo = new ChromeStorageRepository();
    await repo.saveSettings(newSettings);
    setSettings(newSettings);
  };

  const toggleTracking = async (enabled: boolean) => {
    if (!settings) return;
    await saveSettings({ ...settings, isTrackingEnabled: enabled });
  };

  const addBlockedWindow = async (window: BlockedTimeWindow) => {
    if (!settings) return;
    await saveSettings({ 
      ...settings, 
      blockedWindows: [...settings.blockedWindows, window] 
    });
  };

  const removeBlockedWindow = async (id: string) => {
    if (!settings) return;
    await saveSettings({ 
      ...settings, 
      blockedWindows: settings.blockedWindows.filter(w => w.id !== id) 
    });
  };
  
  const updateLimit = async (rule: LimitRule) => {
      if (!settings) return;
      const existing = settings.limits.findIndex(l => l.hostname === rule.hostname);
      const newLimits = [...settings.limits];
      
      if (existing >= 0) {
          newLimits[existing] = rule;
      } else {
          newLimits.push(rule);
      }
      
      await saveSettings({ ...settings, limits: newLimits });
  };
  
  const removeLimit = async (hostname: string) => {
      if (!settings) return;
      await saveSettings({
          ...settings,
          limits: settings.limits.filter(l => l.hostname !== hostname)
      });
  };

  return { 
      settings, 
      loading, 
      toggleTracking, 
      addBlockedWindow, 
      removeBlockedWindow,
      updateLimit,
      removeLimit
 };
}
