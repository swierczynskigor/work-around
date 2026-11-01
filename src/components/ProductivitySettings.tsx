"use client";
import { useEffect, useState } from "react";
import { AppSettings, UsageRecord } from "@/domain/models";
import {
  ChromeStorageRepository,
  USAGE_KEY,
} from "@/data/ChromeStorageRepository";
import { isExtension, sendCommand } from "@/data/extensionClient";
import { dayKey, parseHostname } from "@/services/policies";
import { Language } from "@/lib/i18n";
import { productivityCopy } from "@/lib/productivity-i18n";
import { formatDuration } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";

interface Props {
  settings: AppSettings;
  saveSettings: (value: AppSettings) => Promise<boolean>;
  language: Language;
}
const repository = new ChromeStorageRepository();
const textareaClass =
  "w-full min-h-24 rounded-md border bg-background p-3 text-sm";

export function ProductivitySettings({
  settings,
  saveSettings,
  language,
}: Props) {
  const t = productivityCopy(language);
  const update = (patch: Partial<AppSettings>) =>
    saveSettings({ ...settings, ...patch });
  const toggle = (
    id: string,
    label: string,
    value: boolean,
    patch: (enabled: boolean) => Partial<AppSettings>,
  ) => (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id}>{label}</Label>
      <Switch
        id={id}
        checked={value}
        onCheckedChange={(enabled) => void update(patch(enabled))}
      />
    </div>
  );
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.behavior}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {toggle(
            "blocking",
            t.blocking,
            settings.isBlockingEnabled !== false,
            (isBlockingEnabled) => ({ isBlockingEnabled }),
          )}
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="idle">{t.inactivity}</Label>
            <select
              className="rounded border bg-background p-2"
              id="idle"
              value={settings.idleSeconds}
              onChange={(event) =>
                void update({ idleSeconds: Number(event.target.value) })
              }
            >
              {[60, 180, 300, 600, 1800].map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds / 60} {t.minutes}
                </option>
              ))}
            </select>
          </div>
          {toggle("media", t.media, !!settings.countMedia, (countMedia) => ({
            countMedia,
          }))}
          <p className="text-sm text-muted-foreground">{t.mediaHelp}</p>
          {toggle(
            "warnings",
            t.warnings,
            settings.warningsEnabled !== false,
            (warningsEnabled) => ({ warningsEnabled }),
          )}
          {toggle("strict", t.strict, !!settings.strictMode, (strictMode) => ({
            strictMode,
          }))}
          {toggle(
            "extensions",
            t.extensions,
            !!settings.allowExtensions,
            (allowExtensions) => ({ allowExtensions }),
          )}
          <div className="space-y-2">
            <Label htmlFor="extension-count">{t.extensionCount}</Label>
            <Input
              id="extension-count"
              type="number"
              min="0"
              max="10"
              value={settings.maxExtensionsPerDay}
              onChange={(event) =>
                void update({ maxExtensionsPerDay: Number(event.target.value) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delay">
              {t.delay} · {t.seconds}
            </Label>
            <Input
              id="delay"
              type="number"
              min="0"
              max="60"
              value={settings.entryDelaySeconds}
              onChange={(event) =>
                void update({ entryDelaySeconds: Number(event.target.value) })
              }
            />
            <p className="text-sm text-muted-foreground">{t.delayHelp}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
export function Groups({ settings, saveSettings, language }: Props) {
  const t = productivityCopy(language);
  const [name, setName] = useState(""),
    [domains, setDomains] = useState(""),
    [minutes, setMinutes] = useState("30");
  const [editing, setEditing] = useState<string | null>(null),
    [error, setError] = useState("");
  const clear = () => {
    setEditing(null);
    setName("");
    setDomains("");
    setMinutes("30");
    setError("");
  };
  async function save() {
    try {
      if (
        !name.trim() ||
        !domains.trim() ||
        !Number.isFinite(Number(minutes)) ||
        Number(minutes) <= 0
      )
        throw new Error(t.required);
      const hostnames = [
        ...new Set(
          domains
            .split(/[,\n]/)
            .map((value) => value.trim())
            .filter(Boolean)
            .map(parseHostname),
        ),
      ];
      const group = {
        id: editing || crypto.randomUUID(),
        name: name.trim(),
        hostnames,
        dailyLimitMs: Number(minutes) * 60_000,
      };
      await saveSettings({
        ...settings,
        groups: [
          ...(settings.groups || []).filter((item) => item.id !== editing),
          group,
        ],
      });
      clear();
    } catch (error) {
      setError(error instanceof Error ? error.message : t.required);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.groups}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 rounded-lg border p-4">
          <Label htmlFor="group-name">{t.groupName}</Label>
          <Input
            id="group-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Label htmlFor="group-domains">{t.domains}</Label>
          <textarea
            id="group-domains"
            className={textareaClass}
            value={domains}
            onChange={(event) => setDomains(event.target.value)}
            placeholder="youtube.com, reddit.com"
          />
          <Label htmlFor="group-minutes">{t.budget}</Label>
          <Input
            id="group-minutes"
            type="number"
            min="1"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
          <Button onClick={() => void save()}>
            {editing ? t.save : t.add}
          </Button>
          {editing && (
            <Button variant="ghost" onClick={clear}>
              {t.cancel}
            </Button>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        {(settings.groups || []).map((group) => (
          <div key={group.id} className="rounded border p-3 space-y-2">
            <div className="flex justify-between gap-2">
              <strong>{group.name}</strong>
              <span>{formatDuration(group.dailyLimitMs)}</span>
            </div>
            <p className="text-sm break-words">{group.hostnames.join(", ")}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(group.id);
                setName(group.name);
                setDomains(group.hostnames.join("\n"));
                setMinutes(String(group.dailyLimitMs / 60_000));
              }}
            >
              {t.edit}
            </Button>{" "}
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void saveSettings({
                  ...settings,
                  groups: settings.groups?.filter(
                    (item) => item.id !== group.id,
                  ),
                })
              }
            >
              {t.remove}
            </Button>
          </div>
        ))}
        {!settings.groups?.length && (
          <p className="text-sm text-muted-foreground">{t.noGroups}</p>
        )}
      </CardContent>
    </Card>
  );
}
export function Exceptions({ settings, saveSettings, language }: Props) {
  const t = productivityCopy(language),
    [text, setText] = useState((settings.urlExceptions || []).join("\n")),
    [error, setError] = useState("");
  async function save() {
    const urls = [
      ...new Set(
        text
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    try {
      for (const value of urls) {
        const url = new URL(value);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          throw new Error(t.invalidUrl);
      }
      await saveSettings({ ...settings, urlExceptions: urls });
      setError("");
    } catch {
      setError(t.invalidUrl);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.exceptions}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t.exceptionsHelp}</p>
        <Label htmlFor="exceptions">{t.exceptions}</Label>
        <textarea
          id="exceptions"
          className={textareaClass}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=example"
        />
        <Button onClick={() => void save()}>{t.save}</Button>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
export function ActivityHistory({ language }: { language: Language }) {
  const t = productivityCopy(language),
    [records, setRecords] = useState<UsageRecord[]>([]),
    [date, setDate] = useState(dayKey());
  const [pending, setPending] = useState<string | null>(null),
    [error, setError] = useState(""),
    [count, setCount] = useState(50),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!isExtension()) return;
    const load = () =>
      repository
        .getUsage()
        .then((data) => setRecords(data.records))
        .catch(() => setError(t.error));
    void load();
    const changed = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[USAGE_KEY]) void load();
    };
    chrome.storage.onChanged.addListener(changed);
    return () => chrome.storage.onChanged.removeListener(changed);
  }, [t.error]);
  const matching = records
    .filter((record) => record.day === date)
    .sort((a, b) => b.endedAt - a.endedAt);
  async function remove(id: string) {
    setBusy(true);
    try {
      await sendCommand("DELETE_RECORD", { id });
      setRecords((await repository.getUsage()).records);
      setPending(null);
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : t.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.history}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.historyHelp}</p>
        <Label htmlFor="history-date">{t.date}</Label>
        <select
          id="history-date"
          className="w-full rounded border bg-background p-2"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setCount(50);
            setPending(null);
          }}
        >
          {Array.from({ length: 30 }, (_, offset) => {
            const date = new Date();
            date.setDate(date.getDate() - offset);
            const key = dayKey(date.getTime());
            return (
              <option key={key} value={key}>
                {date.toLocaleDateString(language)}
              </option>
            );
          })}
        </select>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {matching.slice(0, count).map((record) => (
          <div className="rounded border p-3 space-y-2" key={record.id}>
            <div className="flex justify-between gap-2">
              <strong className="break-all">{record.hostname}</strong>
              <span className="whitespace-nowrap">
                {formatDuration(record.durationMs)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {record.kind === "legacy"
                ? t.legacy
                : `${new Date(record.startedAt).toLocaleTimeString(language)}–${new Date(record.endedAt).toLocaleTimeString(language)} · ${record.kind === "media" ? t.background : t.active}`}
            </p>
            {pending === record.id ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void remove(record.id)}
                >
                  {t.confirm}
                </Button>{" "}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPending(null)}
                >
                  {t.cancel}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPending(record.id)}
              >
                {t.remove}
              </Button>
            )}
          </div>
        ))}
        {!matching.length && (
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        )}
        {matching.length > count && (
          <Button variant="outline" onClick={() => setCount(count + 50)}>
            {t.more}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
