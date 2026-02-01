"use client";

import { useState, useEffect, useCallback } from 'react';
import { AppSettings, BlockedTimeWindow, LimitRule } from '@/domain/models';

const SETTINGS_KEY = 'workaround_settings';

const DEFAULT_SETTINGS: AppSettings = {
  isTrackingEnabled: true,
  blockedWindows: [],
  limits: []
};

// Helper to safely check if we're in a Chrome extension context
function isChromeExtension(): boolean {
  try {
    return typeof chrome !== 'undefined' && 
           typeof chrome.storage !== 'undefined' &&
           typeof chrome.storage.sync !== 'undefined';
  } catch {
    return false;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [isExtension, setIsExtension] = useState(false);

  useEffect(() => {
    console.log('[useSettings] Hook mounted, checking environment...');
    
    const inExtension = isChromeExtension();
    setIsExtension(inExtension);
    console.log('[useSettings] Is extension context:', inExtension);

    if (!inExtension) {
      console.warn('[useSettings] Not in extension context, using default settings');
      setLoading(false);
      return;
    }

    // Load settings from chrome.storage
    const loadSettings = async () => {
      try {
        console.log('[useSettings] Loading settings from chrome.storage.sync...');
        chrome.storage.sync.get([SETTINGS_KEY], (result) => {
          if (chrome.runtime.lastError) {
            console.error('[useSettings] Chrome storage error:', chrome.runtime.lastError);
            setLoading(false);
            return;
          }
          
          const savedSettings = result[SETTINGS_KEY] as AppSettings | undefined;
          if (savedSettings) {
            console.log('[useSettings] Loaded settings:', savedSettings);
            setSettings(savedSettings);
          } else {
            console.log('[useSettings] No saved settings, using defaults');
          }
          setLoading(false);
        });
      } catch (e) {
        console.error('[useSettings] Failed to load settings:', e);
        setLoading(false);
      }
    };

    loadSettings();

    // Listen for storage changes
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[SETTINGS_KEY]) {
        console.log('[useSettings] Settings changed externally:', changes[SETTINGS_KEY].newValue);
        setSettings(changes[SETTINGS_KEY].newValue as AppSettings);
      }
    };

    chrome.storage.sync.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.sync.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    if (!isChromeExtension()) {
      console.warn('[useSettings] Cannot save - not in extension context');
      // Still update local state for demo purposes
      setSettings(newSettings);
      return;
    }

    console.log('[useSettings] Saving settings:', newSettings);
    
    return new Promise<void>((resolve, reject) => {
      chrome.storage.sync.set({ [SETTINGS_KEY]: newSettings }, () => {
        if (chrome.runtime.lastError) {
          console.error('[useSettings] Save error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        console.log('[useSettings] Settings saved successfully');
        setSettings(newSettings);
        resolve();
      });
    });
  }, []);

  const toggleTracking = useCallback(async (enabled: boolean) => {
    await saveSettings({ ...settings, isTrackingEnabled: enabled });
  }, [settings, saveSettings]);

  const addBlockedWindow = useCallback(async (window: BlockedTimeWindow) => {
    await saveSettings({ 
      ...settings, 
      blockedWindows: [...settings.blockedWindows, window] 
    });
  }, [settings, saveSettings]);

  const removeBlockedWindow = useCallback(async (id: string) => {
    await saveSettings({ 
      ...settings, 
      blockedWindows: settings.blockedWindows.filter(w => w.id !== id) 
    });
  }, [settings, saveSettings]);
  
  const updateLimit = useCallback(async (rule: LimitRule) => {
    console.log('[useSettings] Adding/updating limit:', rule);
    const existing = settings.limits.findIndex(l => l.hostname === rule.hostname);
    const newLimits = [...settings.limits];
    
    if (existing >= 0) {
      newLimits[existing] = rule;
    } else {
      newLimits.push(rule);
    }
    
    await saveSettings({ ...settings, limits: newLimits });
  }, [settings, saveSettings]);
  
  const removeLimit = useCallback(async (hostname: string) => {
    await saveSettings({
      ...settings,
      limits: settings.limits.filter(l => l.hostname !== hostname)
    });
  }, [settings, saveSettings]);

  return { 
    settings, 
    loading, 
    isExtension,
    toggleTracking, 
    addBlockedWindow, 
    removeBlockedWindow,
    updateLimit,
    removeLimit
  };
}
