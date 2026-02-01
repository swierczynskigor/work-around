"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { AppSettings, LimitRule, TimeWindow } from "@/domain/models";
import { DomainInput } from "@/components/DomainInput";
import { getFaviconUrl } from "@/lib/favicon";
import { Clock, Trash2, Pencil, Check, X, Plus, Sun, Moon, Monitor } from "lucide-react";
import { useI18n, Theme } from "@/hooks/useI18n";
import { Language } from "@/lib/i18n";

const SETTINGS_KEY = 'workaround_settings';

const DEFAULT_SETTINGS: AppSettings = {
  isTrackingEnabled: true,
  blockedWindows: [],
  limits: []
};

export default function OptionsPage() {
  const { t, language, setLanguage, theme, setTheme, availableLanguages } = useI18n();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isExtension, setIsExtension] = useState(false);
  const [newHostname, setNewHostname] = useState("");
  const [newLimitMinutes, setNewLimitMinutes] = useState("");
  const [newTimeWindows, setNewTimeWindows] = useState<TimeWindow[]>([]);
  
  // Edit state
  const [editingHostname, setEditingHostname] = useState<string | null>(null);
  const [editMinutes, setEditMinutes] = useState("");
  const [editTimeWindows, setEditTimeWindows] = useState<TimeWindow[]>([]);

  useEffect(() => {
    const hasChrome = typeof chrome !== 'undefined';
    const hasStorage = hasChrome && typeof chrome.storage !== 'undefined';
    const hasSync = hasStorage && typeof chrome.storage.sync !== 'undefined';
    
    if (!hasSync) return;

    setIsExtension(true);

    chrome.storage.sync.get([SETTINGS_KEY], (result) => {
      if (chrome.runtime.lastError) return;
      
      const saved = result[SETTINGS_KEY] as AppSettings | undefined;
      if (saved) setSettings(saved);
    });
  }, []);

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    if (!isExtension) return;
    chrome.storage.sync.set({ [SETTINGS_KEY]: newSettings });
  };

  const parseTime = (timeStr: string): { hour: number; minute: number } => {
    const [hour, minute] = timeStr.split(':').map(Number);
    return { hour: hour || 0, minute: minute || 0 };
  };

  const formatTime = (hour: number, minute: number): string => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const formatTimeWindow = (tw: TimeWindow): string => {
    return `${formatTime(tw.startHour, tw.startMinute)} - ${formatTime(tw.endHour, tw.endMinute)}`;
  };

  // New limit time windows management
  const addNewTimeWindow = () => {
    setNewTimeWindows([...newTimeWindows, { startHour: 16, startMinute: 0, endHour: 23, endMinute: 0 }]);
  };

  const updateNewTimeWindow = (index: number, field: 'start' | 'end', value: string) => {
    const { hour, minute } = parseTime(value);
    setNewTimeWindows(prev => prev.map((tw, i) => 
      i === index 
        ? { ...tw, [field === 'start' ? 'startHour' : 'endHour']: hour, [field === 'start' ? 'startMinute' : 'endMinute']: minute }
        : tw
    ));
  };

  const removeNewTimeWindow = (index: number) => {
    setNewTimeWindows(prev => prev.filter((_, i) => i !== index));
  };

  // Edit time windows management
  const addEditTimeWindow = () => {
    setEditTimeWindows([...editTimeWindows, { startHour: 16, startMinute: 0, endHour: 23, endMinute: 0 }]);
  };

  const updateEditTimeWindow = (index: number, field: 'start' | 'end', value: string) => {
    const { hour, minute } = parseTime(value);
    setEditTimeWindows(prev => prev.map((tw, i) => 
      i === index 
        ? { ...tw, [field === 'start' ? 'startHour' : 'endHour']: hour, [field === 'start' ? 'startMinute' : 'endMinute']: minute }
        : tw
    ));
  };

  const removeEditTimeWindow = (index: number) => {
    setEditTimeWindows(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddLimit = () => {
    const hostname = newHostname.trim().toLowerCase();
    const minutes = parseInt(newLimitMinutes);
    
    if (!hostname || isNaN(minutes) || minutes <= 0) return;

    const newLimit: LimitRule = {
      hostname,
      dailyLimitMs: minutes * 60 * 1000,
      ...(newTimeWindows.length > 0 && { allowedTimeWindows: newTimeWindows })
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
    setNewTimeWindows([]);
  };

  const handleRemoveLimit = (hostname: string) => {
    saveSettings({
      ...settings,
      limits: settings.limits.filter(l => l.hostname !== hostname)
    });
  };

  const handleToggleTracking = (enabled: boolean) => {
    saveSettings({ ...settings, isTrackingEnabled: enabled });
  };

  const startEditing = (limit: LimitRule) => {
    setEditingHostname(limit.hostname);
    setEditMinutes(Math.round(limit.dailyLimitMs / 60000).toString());
    setEditTimeWindows(limit.allowedTimeWindows ? [...limit.allowedTimeWindows] : []);
  };

  const cancelEditing = () => {
    setEditingHostname(null);
    setEditTimeWindows([]);
  };

  const saveEditing = () => {
    if (!editingHostname) return;
    
    const minutes = parseInt(editMinutes);
    if (isNaN(minutes) || minutes <= 0) return;

    const updatedLimit: LimitRule = {
      hostname: editingHostname,
      dailyLimitMs: minutes * 60 * 1000,
      ...(editTimeWindows.length > 0 && { allowedTimeWindows: editTimeWindows })
    };

    const newLimits = settings.limits.map(l => 
      l.hostname === editingHostname ? updatedLimit : l
    );

    saveSettings({ ...settings, limits: newLimits });
    setEditingHostname(null);
    setEditTimeWindows([]);
  };

  const TimeWindowEditor = ({ 
    windows, 
    onAdd, 
    onUpdate, 
    onRemove 
  }: { 
    windows: TimeWindow[]; 
    onAdd: () => void; 
    onUpdate: (index: number, field: 'start' | 'end', value: string) => void;
    onRemove: (index: number) => void;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4" />
        <span className="text-sm font-medium">{t.options.allowedHours}</span>
        <Button type="button" variant="outline" size="sm" onClick={onAdd} className="ml-auto h-7">
          <Plus className="w-3 h-3 mr-1" /> {t.options.addWindow}
        </Button>
      </div>
      {windows.map((tw, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input 
            type="time" 
            value={formatTime(tw.startHour, tw.startMinute)}
            onChange={(e) => onUpdate(index, 'start', e.target.value)}
            className="w-[100px] h-8"
          />
          <span className="text-muted-foreground">{t.options.to}</span>
          <Input 
            type="time" 
            value={formatTime(tw.endHour, tw.endMinute)}
            onChange={(e) => onUpdate(index, 'end', e.target.value)}
            className="w-[100px] h-8"
          />
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={() => onRemove(index)}
            className="h-8 w-8 text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8 max-w-3xl space-y-8">
        <header>
          <h1 className="text-3xl font-bold">{t.options.title}</h1>
          <p className="text-muted-foreground">{t.options.subtitle}</p>
        </header>
        
        {!isExtension && (
          <div className="p-3 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded-md text-sm">
            ⚠️ {t.options.notInExtension}
          </div>
        )}

        {/* Extension Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t.settings.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t.settings.language}</Label>
              <Select value={language} onValueChange={(val) => setLanguage(val as Language)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(availableLanguages).map(([code, name]) => (
                    <SelectItem key={code} value={code}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <Label>{t.settings.theme}</Label>
              <div className="flex gap-1">
                <Button 
                  variant={theme === 'light' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setTheme('light')}
                  className="gap-1"
                >
                  <Sun className="w-4 h-4" />
                  {t.settings.themeLight}
                </Button>
                <Button 
                  variant={theme === 'dark' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setTheme('dark')}
                  className="gap-1"
                >
                  <Moon className="w-4 h-4" />
                  {t.settings.themeDark}
                </Button>
                <Button 
                  variant={theme === 'system' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setTheme('system')}
                  className="gap-1"
                >
                  <Monitor className="w-4 h-4" />
                  {t.settings.themeSystem}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t.options.general}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <Label htmlFor="tracking-mode">{t.options.enableTracking}</Label>
            <Switch 
              id="tracking-mode" 
              checked={settings.isTrackingEnabled} 
              onCheckedChange={handleToggleTracking} 
            />
          </CardContent>
        </Card>

        {/* Daily Limits */}
        <Card>
          <CardHeader>
            <CardTitle>{t.options.dailyLimits}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add new limit form */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
              <div className="flex gap-2">
                <DomainInput 
                  value={newHostname}
                  onChange={setNewHostname}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLimit()}
                  className="flex-1"
                />
                <Input 
                  type="number" 
                  placeholder={t.options.minutes}
                  className="w-[100px]"
                  value={newLimitMinutes}
                  onChange={(e) => setNewLimitMinutes(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLimit()}
                  min="1"
                />
                <Button onClick={handleAddLimit}>
                  {t.options.addButton}
                </Button>
              </div>

              <TimeWindowEditor 
                windows={newTimeWindows}
                onAdd={addNewTimeWindow}
                onUpdate={updateNewTimeWindow}
                onRemove={removeNewTimeWindow}
              />
            </div>

            {/* Limits list */}
            <div className="space-y-2">
              {settings.limits.map(limit => (
                <div key={limit.hostname} className="border rounded-md bg-muted/30">
                  {editingHostname === limit.hostname ? (
                    // Edit mode
                    <div className="p-3 space-y-3">
                      <div className="flex items-center gap-3">
                        <img 
                          src={getFaviconUrl(limit.hostname, 20)} 
                          alt="" 
                          className="w-5 h-5"
                        />
                        <span className="font-medium">{limit.hostname}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number" 
                          value={editMinutes}
                          onChange={(e) => setEditMinutes(e.target.value)}
                          className="w-[100px]"
                          min="1"
                        />
                        <span className="text-sm text-muted-foreground">{t.options.minPerDay}</span>
                      </div>

                      <TimeWindowEditor 
                        windows={editTimeWindows}
                        onAdd={addEditTimeWindow}
                        onUpdate={updateEditTimeWindow}
                        onRemove={removeEditTimeWindow}
                      />

                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEditing}>
                          <Check className="w-4 h-4 mr-1" /> {t.options.save}
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEditing}>
                          <X className="w-4 h-4 mr-1" /> {t.options.cancel}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <img 
                          src={getFaviconUrl(limit.hostname, 20)} 
                          alt="" 
                          className="w-5 h-5"
                        />
                        <div>
                          <span className="font-medium">{limit.hostname}</span>
                          {limit.allowedTimeWindows && limit.allowedTimeWindows.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                              <Clock className="w-3 h-3" />
                              {limit.allowedTimeWindows.map((tw, i) => (
                                <span key={i}>
                                  {formatTimeWindow(tw)}{i < limit.allowedTimeWindows!.length - 1 ? ',' : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">
                          {Math.round(limit.dailyLimitMs / 60000)} {t.options.minPerDay}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => startEditing(limit)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleRemoveLimit(limit.hostname)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {settings.limits.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t.options.noLimits}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
