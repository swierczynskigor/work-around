"use client";

import { useSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { BlockedTimeWindow } from "@/domain/models";

export default function OptionsPage() {
  const { settings, loading, toggleTracking, addBlockedWindow, removeBlockedWindow, updateLimit, removeLimit } = useSettings();
  const [newHostname, setNewHostname] = useState("");
  const [newLimitMinutes, setNewLimitMinutes] = useState("");

  if (loading) {
      return <div className="p-8">Loading settings...</div>;
  }

  if (!settings) {
      return <div className="p-8">Settings not available. Are you running in the extension?</div>;
  }

  const handleAddLimit = () => {
    if (newHostname && newLimitMinutes) {
        updateLimit({
            hostname: newHostname,
            dailyLimitMs: parseInt(newLimitMinutes) * 60 * 1000
        });
        setNewHostname("");
        setNewLimitMinutes("");
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold">WorkAround Settings</h1>
        <p className="text-muted-foreground">Manage your productivity rules</p>
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
                onCheckedChange={toggleTracking} 
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
                  />
                  <Input 
                    type="number" 
                    placeholder="Minutes" 
                    className="w-[100px]"
                    value={newLimitMinutes}
                    onChange={(e) => setNewLimitMinutes(e.target.value)}
                  />
                  <Button onClick={handleAddLimit}>Add</Button>
              </div>

              <div className="space-y-2">
                  {settings.limits.map(limit => (
                      <div key={limit.hostname} className="flex items-center justify-between p-2 border rounded">
                          <span className="font-medium">{limit.hostname}</span>
                          <div className="flex items-center gap-4">
                              <span>{Math.round(limit.dailyLimitMs / 60000)}m / day</span>
                              <Button variant="destructive" size="sm" onClick={() => removeLimit(limit.hostname)}>Remove</Button>
                          </div>
                      </div>
                  ))}
                  {settings.limits.length === 0 && <p className="text-sm text-muted-foreground">No limits defined.</p>}
              </div>
          </CardContent>
      </Card>
      
      {/* Time Windows would go here, omitting for brevity in MVP iteration */}
    </div>
  );
}
