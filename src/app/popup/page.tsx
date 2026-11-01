"use client";
import { TimeExtensionForm } from "@/components/TimeExtensionForm";
import { AppIcon } from "@/components/AppIcon";
import { useState } from "react";
import { useStats } from "@/hooks/useStats";
import { useI18n } from "@/hooks/useI18n";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import { getFaviconUrl } from "@/lib/favicon";
import { experienceCopy } from "@/lib/experience-i18n";
import { sendCommand, isExtension } from "@/data/extensionClient";

export default function PopupPage() {
  const { stats, currentTabStats, session, refresh, error } = useStats();
  const { t, language } = useI18n();
  const copy = experienceCopy(language);
  const [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false);
  const policy = session?.policy;
  async function action(type: string, payload = {}) {
    setBusy(true);
    try {
      await sendCommand(type, payload);
      await refresh();
      setActionError("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="w-[350px] h-[580px] bg-background flex flex-col p-4 gap-3">
      <header className="flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2.5">
          <AppIcon />
          {t.popup.title}
        </h1>
        <Button
          aria-label={copy.settings}
          variant="ghost"
          size="icon"
          onClick={() => {
            if (isExtension())
              void chrome.tabs.create({
                url: chrome.runtime.getURL("options.html"),
              });
            else window.open("./options.html", "_blank");
          }}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </header>
      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-sm" role="status">
          <span
            className={`inline-block w-2 h-2 rounded-full mr-2 ${session?.status === "tracking" || session?.status === "media" ? "bg-primary" : "bg-muted-foreground"}`}
          />
          {session ? copy[session.status] : t.popup.notValidSite}
        </p>
        {session?.pausedUntil && (
          <p className="text-xs text-muted-foreground">
            {new Date(session.pausedUntil).toLocaleTimeString(language)}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={busy || session?.status === "disabled"}
          onClick={() =>
            void action("PAUSE_TRACKING", {
              minutes: session?.pausedUntil ? 0 : 15,
            })
          }
        >
          {session?.pausedUntil ? copy.resume : copy.pause}
        </Button>
      </div>
      {(error || actionError) && (
        <p role="alert" className="text-sm text-destructive">
          {error || actionError}
        </p>
      )}
      <main className="flex-1 flex flex-col gap-3 min-h-0">
        <section className="space-y-2">
          <h2 className="text-sm text-muted-foreground">
            {t.popup.currentSite}
          </h2>
          {currentTabStats ? (
            <StatsCard
              stats={currentTabStats}
              translations={t}
              policy={policy}
            />
          ) : (
            <p className="text-sm border rounded p-3">{t.popup.notValidSite}</p>
          )}
          {policy?.budgetName && (
            <p className="text-xs text-muted-foreground">
              {copy.budget}: {policy.budgetName}
            </p>
          )}
          {policy?.extensionUntil && (
            <p className="text-xs">
              {copy.extensionEnds}:{" "}
              {new Date(policy.extensionUntil).toLocaleTimeString(language)}
            </p>
          )}
          {policy?.canExtend && (
            <TimeExtensionForm
              key={`${session?.hostname}:${policy.pinRequired}`}
              pinRequired={policy.pinRequired}
              language={language}
              refresh={refresh}
            />
          )}
        </section>
        <section className="flex-1 flex flex-col min-h-0 gap-2">
          <h2 className="text-sm text-muted-foreground">
            {t.popup.topSitesToday}
          </h2>
          <div className="flex-1 border rounded-md overflow-y-auto p-2 space-y-2">
            {[...stats]
              .sort((a, b) => b.timeSpentMs - a.timeSpentMs)
              .map((stat) => (
                <div
                  key={stat.hostname}
                  className="flex justify-between items-center gap-2 text-sm p-2 bg-muted/50 rounded"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={getFaviconUrl(stat.hostname, 16)}
                      alt=""
                      className="w-4 h-4"
                    />
                    <span className="truncate">{stat.hostname}</span>
                  </div>
                  <span className="font-mono text-xs whitespace-nowrap">
                    {formatDuration(stat.timeSpentMs)}
                  </span>
                </div>
              ))}
            {!stats.length && (
              <p className="text-muted-foreground text-center py-4">
                {copy.noActivity}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
