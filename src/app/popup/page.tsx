"use client";

import { useStats } from "@/hooks/useStats";
import { useI18n } from "@/hooks/useI18n";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import { getFaviconUrl } from "@/lib/favicon";

export default function PopupPage() {
  const { stats, currentTabStats, currentHostname, currentLimit } = useStats();
  const { t } = useI18n();

  // Sort stats by time spent (descending)
  const sortedStats = [...stats].sort((a, b) => b.timeSpentMs - a.timeSpentMs);

  const openOptions = () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open('./options.html', '_blank');
      }
    } catch (e) {
      console.error('Failed to open options:', e);
      window.open('./options.html', '_blank');
    }
  };

  return (
    <div className="w-[350px] h-[500px] bg-background flex flex-col p-4">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">{t.popup.title}</h1>
        <Button variant="ghost" size="icon" onClick={openOptions}>
          <Settings className="h-5 w-5" />
        </Button>
      </header>
      
      <main className="flex-1 flex flex-col gap-4 overflow-hidden">
        <section className="flex-shrink-0">
          <h2 className="text-sm text-muted-foreground mb-2">{t.popup.currentSite}</h2>
          {currentTabStats ? (
            <StatsCard stats={currentTabStats} limit={currentLimit} translations={t} />
          ) : (
            <div className="text-sm text-center p-4 border rounded-md">
              {currentHostname ? (
                  <div className="flex flex-col gap-2">
                      <span>{t.popup.noStats} <strong>{currentHostname}</strong></span>
                      <p className="text-xs text-muted-foreground">{t.popup.goToOptions}</p>
                  </div>
              ) : t.popup.notValidSite}
            </div>
          )}
        </section>

        <section className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <h2 className="text-sm text-muted-foreground mb-2 flex-shrink-0">{t.popup.topSitesToday}</h2>
          <div className="flex-1 border rounded-md overflow-y-auto">
            <div className="p-2 space-y-2">
              {sortedStats.map(stat => (
                <div key={stat.hostname} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                   <div className="flex items-center gap-2 overflow-hidden">
                      <img 
                        src={getFaviconUrl(stat.hostname, 16)} 
                        alt="" 
                        className="w-4 h-4 flex-shrink-0" 
                        loading="lazy"
                      />
                      <span className="truncate max-w-[150px]">{stat.hostname}</span>
                   </div>
                   <span className="font-mono text-xs">{formatDuration(stat.timeSpentMs)}</span>
                </div>
              ))}
              {sortedStats.length === 0 && (
                 <div className="text-muted-foreground text-center py-4">{t.popup.noActivity}</div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
