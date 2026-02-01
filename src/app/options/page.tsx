"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { AppSettings, LimitRule } from "@/domain/models";

const SETTINGS_KEY = 'workaround_settings';

const DEFAULT_SETTINGS: AppSettings = {
  isTrackingEnabled: true,
  blockedWindows: [],
  limits: []
};

export default function OptionsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isExtension, setIsExtension] = useState(false);
  const [newHostname, setNewHostname] = useState("");
  const [newLimitMinutes, setNewLimitMinutes] = useState("");
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log(msg);
    setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  useEffect(() => {
    addLog('[OptionsPage] Component mounted');
    
    // Check Chrome extension context
    const hasChrome = typeof chrome !== 'undefined';
    const hasStorage = hasChrome && typeof chrome.storage !== 'undefined';
    const hasSync = hasStorage && typeof chrome.storage.sync !== 'undefined';
    
    addLog(`[OptionsPage] chrome: ${hasChrome}, storage: ${hasStorage}, sync: ${hasSync}`);
    
    if (!hasSync) {
      addLog('[OptionsPage] Not in extension context');
      return;
    }

    setIsExtension(true);
    addLog('[OptionsPage] In extension context, loading settings...');

    // Load settings
    chrome.storage.sync.get([SETTINGS_KEY], (result) => {
      if (chrome.runtime.lastError) {
        addLog(`[OptionsPage] Error: ${chrome.runtime.lastError.message}`);
        return;
      }
      
      const saved = result[SETTINGS_KEY] as AppSettings | undefined;
      if (saved) {
        addLog(`[OptionsPage] Loaded settings with ${saved.limits.length} limits`);
        setSettings(saved);
      } else {
        addLog('[OptionsPage] No saved settings, using defaults');
      }
    });
  }, []);

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    
    if (!isExtension) {
      addLog('[OptionsPage] Would save (but not in extension): ' + JSON.stringify(newSettings.limits));
      return;
    }

    chrome.storage.sync.set({ [SETTINGS_KEY]: newSettings }, () => {
      if (chrome.runtime.lastError) {
        addLog(`[OptionsPage] Save error: ${chrome.runtime.lastError.message}`);
      } else {
        addLog(`[OptionsPage] Saved! Limits: ${newSettings.limits.length}`);
      }
    });
  };

  const handleAddLimit = () => {
    const hostname = newHostname.trim().toLowerCase();
    const minutes = parseInt(newLimitMinutes);
    
    if (!hostname || isNaN(minutes) || minutes <= 0) {
      addLog('[OptionsPage] Invalid input');
      return;
    }

    addLog(`[OptionsPage] Adding limit: ${hostname} = ${minutes} min`);
    
    const newLimit: LimitRule = {
      hostname,
      dailyLimitMs: minutes * 60 * 1000
    };

    const existingIndex = settings.limits.findIndex(l => l.hostname === hostname);
    const newLimits = [...settings.limits];
    
    if (existingIndex >= 0) {
      newLimits[existingIndex] = newLimit;
    } else {
      newLimits.push(newLimit);
    }

    saveSettings({ ...settings, limits: newLimits });
    setNewHostname("");
    setNewLimitMinutes("");
  };

  const handleRemoveLimit = (hostname: string) => {
    addLog(`[OptionsPage] Removing limit: ${hostname}`);
    saveSettings({
      ...settings,
      limits: settings.limits.filter(l => l.hostname !== hostname)
    });
  };

  const handleToggleTracking = (enabled: boolean) => {
    addLog(`[OptionsPage] Toggle tracking: ${enabled}`);
    saveSettings({ ...settings, isTrackingEnabled: enabled });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8 max-w-3xl space-y-8">
        <header>
          <h1 className="text-3xl font-bold">WorkAround Settings</h1>
          <p className="text-muted-foreground">Manage your productivity rules</p>
          {!isExtension && (
            <div className="mt-2 p-3 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded-md text-sm">
              ⚠️ Not running in extension context. Settings won&apos;t be saved.
            </div>
          )}
        </header>
        
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <Label htmlFor="tracking-mode">Enable Time Tracking</Label>
            <Switch 
              id="tracking-mode" 
              checked={settings.isTrackingEnabled} 
              onCheckedChange={handleToggleTracking} 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Domain (e.g. facebook.com)" 
                value={newHostname}
                onChange={(e) => setNewHostname(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddLimit()}
                className="flex-1"
              />
              <Input 
                type="number" 
                placeholder="Minutes" 
                className="w-[100px]"
                value={newLimitMinutes}
                onChange={(e) => setNewLimitMinutes(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddLimit()}
                min="1"
              />
              <Button onClick={handleAddLimit}>
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {settings.limits.map(limit => (
                <div key={limit.hostname} className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
                  <span className="font-medium">{limit.hostname}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">{Math.round(limit.dailyLimitMs / 60000)} min/day</span>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleRemoveLimit(limit.hostname)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              {settings.limits.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No limits defined. Add a domain above to get started.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Debug section */}
        <Card>
          <CardHeader>
            <CardTitle>Debug Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs font-mono bg-muted p-2 rounded max-h-40 overflow-auto">
              {debugLog.length === 0 ? (
                <p className="text-muted-foreground">No logs yet - if you see this, React hydration worked!</p>
              ) : (
                debugLog.map((log, i) => <div key={i}>{log}</div>)
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
