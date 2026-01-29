"use client";

import { useStats } from "@/hooks/useStats";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings } from "lucide-react";
import { formatDuration } from "@/lib/utils";

export default function PopupPage() {
  const { stats, currentTabStats, currentHostname } = useStats();

  // Sort stats by time spent (descending)
  const sortedStats = [...stats].sort((a, b) => b.timeSpentMs - a.timeSpentMs);

  const openOptions = () => {
    if (chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('/options.html', '_blank');
    }
  };

  return (
    <div className="w-[350px] h-[500px] bg-background flex flex-col p-4">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">WorkAround</h1>
        <Button variant="ghost" size="icon" onClick={openOptions}>
          <Settings className="h-5 w-5" />
        </Button>
      </header>
      
      <main className="flex-1 overflow-hidden flex flex-col gap-4">
        <section>
          <h2 className="text-sm text-muted-foreground mb-2">Current Site</h2>
          {currentTabStats ? (
            <StatsCard stats={currentTabStats} />
          ) : (
            <div className="text-sm text-center p-4 border rounded-md">
              {currentHostname ? `No stats for ${currentHostname}` : "Not a valid site"}
            </div>
          )}
        </section>

        <section className="flex-1 flex flex-col min-h-0">
          <h2 className="text-sm text-muted-foreground mb-2">Top Sites Today</h2>
          <ScrollArea className="flex-1 border rounded-md p-2">
            <div className="space-y-2">
              {sortedStats.map(stat => (
                <div key={stat.hostname} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                   <div className="flex items-center gap-2 overflow-hidden">
                      {stat.favIconUrl && <img src={stat.favIconUrl} className="w-4 h-4" />}
                      <span className="truncate max-w-[150px]">{stat.hostname}</span>
                   </div>
                   <span className="font-mono">{formatDuration(stat.timeSpentMs)}</span>
                </div>
              ))}
              {sortedStats.length === 0 && (
                 <div className="text-muted-foreground text-center py-4">No activity recorded yet</div>
              )}
            </div>
          </ScrollArea>
        </section>
      </main>
    </div>
  );
}
