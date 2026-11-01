"use client";
import { useEffect, useState } from "react";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { AppSettings, BlockedTimeWindow } from "@/domain/models";
import { Language } from "@/lib/i18n";
import { focusSecurityCopy } from "@/lib/focus-security-i18n";
import { productivityCopy } from "@/lib/productivity-i18n";
import { isFocusBlocked } from "@/services/policies";
import { createFocusSchedule, scheduleTime } from "@/services/focus";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";

type Props = {
  settings: AppSettings;
  saveSettings: (value: AppSettings) => Promise<boolean>;
  language: Language;
};
const week = [1, 2, 3, 4, 5, 6, 0];
function dayName(
  day: number,
  language: Language,
  weekday: "short" | "long" = "short",
) {
  return new Date(2024, 0, 7 + day).toLocaleDateString(language, { weekday });
}
export function FocusPanel({ settings, saveSettings, language }: Props) {
  const t = focusSecurityCopy(language),
    common = productivityCopy(language);
  const [editor, setEditor] = useState<BlockedTimeWindow | "new" | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const active =
    settings.isBlockingEnabled !== false && isFocusBlocked(settings, now);
  async function update(windows: BlockedTimeWindow[]) {
    setBusy(true);
    try {
      return await saveSettings({ ...settings, blockedWindows: windows });
    } finally {
      setBusy(false);
    }
  }
  function preset(evening: boolean) {
    setEditor({
      id: "",
      name: evening ? t.eveningPreset : t.weekdaysPreset,
      startHour: evening ? 20 : 9,
      startMinute: 0,
      endHour: evening ? 22 : 17,
      endMinute: 0,
      daysOfWeek: evening ? week : [1, 2, 3, 4, 5],
      isEnabled: true,
    });
  }
  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5 text-primary" />
            {t.focusTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t.focusHelp}</p>
          <p role="status" className="font-medium text-primary">
            {active
              ? t.active
              : settings.blockedWindows.some((item) => item.isEnabled)
                ? t.ready
                : settings.blockedWindows.length
                  ? t.pausedAll
                  : t.empty}
          </p>
          {settings.isBlockingEnabled === false && (
            <div className="rounded-lg border bg-background p-4 space-y-3">
              <p className="text-sm">{t.blockingOff}</p>
              <Button
                variant="outline"
                onClick={() =>
                  void saveSettings({ ...settings, isBlockingEnabled: true })
                }
              >
                {t.enableBlocking}
              </Button>
            </div>
          )}
          {!settings.blockedWindows.length && (
            <p className="text-sm text-muted-foreground">{t.emptyHelp}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setEditor("new")} disabled={busy}>
              <Plus className="size-4" />
              {t.addSchedule}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => preset(false)}
            >
              {t.weekdaysPreset}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => preset(true)}
            >
              {t.eveningPreset}
            </Button>
          </div>
        </CardContent>
      </Card>
      {editor !== null && (
        <FocusEditor
          key={editor === "new" ? "new" : JSON.stringify(editor)}
          schedule={editor === "new" ? undefined : editor}
          language={language}
          onCancel={() => setEditor(null)}
          onSave={async (value) => {
            const exists = settings.blockedWindows.some(
              (item) => item.id === value.id,
            );
            const saved = await update(
              exists
                ? settings.blockedWindows.map((item) =>
                    item.id === value.id ? value : item,
                  )
                : [...settings.blockedWindows, value],
            );
            if (saved) setEditor(null);
          }}
        />
      )}
      <div className="space-y-3">
        {settings.blockedWindows.map((schedule) => {
          const name = schedule.name || t.untitled;
          const start = scheduleTime(schedule.startHour, schedule.startMinute),
            end = scheduleTime(schedule.endHour, schedule.endMinute);
          return (
            <Card
              key={schedule.id}
              className={schedule.isEnabled ? "" : "opacity-70"}
            >
              <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-medium">{name}</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {start} <span className="text-muted-foreground">–</span>{" "}
                    {end}
                    {start > end && (
                      <span className="text-sm text-primary"> +1</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {week
                      .filter((day) => schedule.daysOfWeek.includes(day))
                      .map((day) => dayName(day, language))
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {schedule.isEnabled ? t.enabled : t.disabled}
                  </span>
                  <Switch
                    aria-label={`${t.enableSchedule}: ${name}`}
                    checked={schedule.isEnabled}
                    disabled={busy}
                    onCheckedChange={(isEnabled) =>
                      void update(
                        settings.blockedWindows.map((item) =>
                          item.id === schedule.id
                            ? { ...item, isEnabled }
                            : item,
                        ),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${common.edit}: ${name}`}
                    disabled={busy}
                    onClick={() => setEditor(schedule)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${common.remove}: ${name}`}
                    disabled={busy}
                    onClick={() => {
                      if (editor !== "new" && editor?.id === schedule.id)
                        setEditor(null);
                      void update(
                        settings.blockedWindows.filter(
                          (item) => item.id !== schedule.id,
                        ),
                      );
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
function FocusEditor({
  schedule,
  language,
  onCancel,
  onSave,
}: {
  schedule?: BlockedTimeWindow;
  language: Language;
  onCancel: () => void;
  onSave: (value: BlockedTimeWindow) => Promise<void>;
}) {
  const t = focusSecurityCopy(language),
    common = productivityCopy(language);
  const [name, setName] = useState(schedule?.name || "");
  const [start, setStart] = useState(
    schedule ? scheduleTime(schedule.startHour, schedule.startMinute) : "09:00",
  );
  const [end, setEnd] = useState(
    schedule ? scheduleTime(schedule.endHour, schedule.endMinute) : "17:00",
  );
  const [days, setDays] = useState(schedule?.daysOfWeek || [1, 2, 3, 4, 5]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{schedule?.id ? common.edit : t.addSchedule}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            let value: BlockedTimeWindow;
            try {
              value = createFocusSchedule({
                id: schedule?.id,
                name,
                start,
                end,
                days,
                isEnabled: schedule?.isEnabled ?? true,
              });
            } catch {
              setError(t.invalidSchedule);
              return;
            }
            setBusy(true);
            try {
              await onSave(value);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="focus-name">{t.scheduleName}</Label>
              <Input
                id="focus-name"
                autoFocus
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t.namePlaceholder}
              />
            </div>
            <div className="space-y-3">
              <p className="font-medium">{t.chooseDays}</p>
              <div className="flex flex-wrap gap-2">
                {[
                  [t.workdays, [1, 2, 3, 4, 5]],
                  [t.everyDay, week],
                  [t.weekend, [6, 0]],
                ].map(([label, value]) => (
                  <Button
                    type="button"
                    key={label as string}
                    variant="outline"
                    size="sm"
                    onClick={() => setDays(value as number[])}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label={common.days}
              >
                {week.map((day) => (
                  <Button
                    type="button"
                    key={day}
                    variant={days.includes(day) ? "default" : "outline"}
                    size="sm"
                    aria-label={dayName(day, language, "long")}
                    aria-pressed={days.includes(day)}
                    onClick={() =>
                      setDays(
                        days.includes(day)
                          ? days.filter((item) => item !== day)
                          : [...days, day],
                      )
                    }
                  >
                    {dayName(day, language)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <p className="font-medium">{t.chooseHours}</p>
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="focus-start">{t.start}</Label>
                  <Input
                    type="time"
                    id="focus-start"
                    required
                    value={start}
                    onChange={(event) => setStart(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="focus-end">{t.end}</Label>
                  <Input
                    type="time"
                    id="focus-end"
                    required
                    value={end}
                    onChange={(event) => setEnd(event.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="font-medium">{t.review}</p>
              <p className="text-sm">
                {week
                  .filter((day) => days.includes(day))
                  .map((day) => dayName(day, language))
                  .join(" · ")}{" "}
                · {start}–{end}
              </p>
              {start > end && (
                <p className="text-sm text-primary">{t.overnight}</p>
              )}
              <p className="text-xs text-muted-foreground">{t.focusHelp}</p>
              {schedule && !schedule.isEnabled && (
                <p className="text-sm text-muted-foreground">{t.disabled}</p>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="submit">{common.save}</Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                {common.cancel}
              </Button>
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
