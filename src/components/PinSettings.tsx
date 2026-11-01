"use client";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { AppSettings, PinStatus } from "@/domain/models";
import { usePinSettings } from "@/hooks/usePinSettings";
import { Language } from "@/lib/i18n";
import { focusSecurityCopy, pinErrorText } from "@/lib/focus-security-i18n";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function PinSettings({
  settings,
  language,
}: {
  settings: AppSettings;
  language: Language;
}) {
  const { status, error, save } = usePinSettings();
  const t = focusSecurityCopy(language);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          {t.pinTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.pinHelp}</p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {pinErrorText(error, language)}
          </p>
        ) : status ? (
          <PinForm
            key={`${status.isConfigured}:${status.protectedDomains.join(",")}`}
            status={status}
            settings={settings}
            language={language}
            save={save}
          />
        ) : (
          <p role="status">{t.loading}</p>
        )}
      </CardContent>
    </Card>
  );
}
function PinForm({
  status,
  settings,
  language,
  save,
}: {
  status: PinStatus;
  settings: AppSettings;
  language: Language;
  save: (
    payload: Record<string, unknown>,
    remove?: boolean,
  ) => Promise<PinStatus>;
}) {
  const t = focusSecurityCopy(language);
  const [currentPin, setCurrentPin] = useState(""),
    [newPin, setNewPin] = useState(""),
    [confirmPin, setConfirmPin] = useState("");
  const [domains, setDomains] = useState(status.protectedDomains.join("\n"));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const suggestions = [
    ...new Set([
      ...settings.limits.map((rule) => rule.hostname),
      ...(settings.groups || []).flatMap((group) => group.hostnames),
    ]),
  ];
  async function submit(remove = false) {
    setError("");
    setSaved(false);
    if (
      !remove &&
      (newPin || !status.isConfigured) &&
      !/^\d{4,8}$/.test(newPin)
    ) {
      setError(t.pinFormat);
      return;
    }
    if (!remove && newPin !== confirmPin) {
      setError(t.pinMismatch);
      return;
    }
    setBusy(true);
    try {
      await save(
        {
          currentPin,
          ...(newPin ? { newPin } : {}),
          domains: domains
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
        },
        remove,
      );
      setSaved(true);
    } catch (error) {
      setError(pinErrorText(error, language));
    } finally {
      setBusy(false);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    }
  }
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="text-sm font-medium text-primary">
        {status.isConfigured ? t.configured : t.notConfigured}
      </p>
      <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
        <div className="grid gap-4 sm:grid-cols-3">
          {status.isConfigured && (
            <div className="space-y-2">
              <Label htmlFor="current-pin">{t.currentPin}</Label>
              <Input
                id="current-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                value={currentPin}
                onChange={(event) => setCurrentPin(event.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-pin">{t.newPin}</Label>
            <Input
              id="new-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              pattern="[0-9]{4,8}"
              maxLength={8}
              value={newPin}
              onChange={(event) => setNewPin(event.target.value)}
              required={!status.isConfigured}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pin">{t.confirmPin}</Label>
            <Input
              id="confirm-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={8}
              value={confirmPin}
              onChange={(event) => setConfirmPin(event.target.value)}
              required={!!newPin}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t.pinHint}</p>
        <div className="space-y-2">
          <Label htmlFor="pin-domains">{t.protectedSites}</Label>
          <p id="pin-domains-help" className="text-sm text-muted-foreground">
            {t.domainsHint}
          </p>
          <textarea
            id="pin-domains"
            aria-describedby="pin-domains-help"
            className="w-full min-h-28 rounded-md border bg-background p-3 text-sm"
            value={domains}
            onChange={(event) => setDomains(event.target.value)}
            placeholder="youtube.com&#10;reddit.com"
          />
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((domain) => {
                const selected = domains
                  .split("\n")
                  .map((value) => value.trim())
                  .includes(domain);
                return (
                  <Button
                    key={domain}
                    type="button"
                    size="sm"
                    variant={selected ? "secondary" : "outline"}
                    aria-pressed={selected}
                    onClick={() =>
                      setDomains(
                        selected
                          ? domains
                              .split("\n")
                              .filter((value) => value.trim() !== domain)
                              .join("\n")
                          : [domains.trim(), domain].filter(Boolean).join("\n"),
                      )
                    }
                  >
                    {selected ? "✓ " : "+ "}
                    {domain}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t.securityHint}</p>
        <div className="flex flex-wrap gap-3">
          <Button type="submit">{t.savePin}</Button>
          {status.isConfigured && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void submit(true)}
            >
              {t.removePin}
            </Button>
          )}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-primary">
          {t.saved}
        </p>
      )}
    </form>
  );
}
