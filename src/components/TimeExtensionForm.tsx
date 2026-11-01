"use client";
import { useState } from "react";
import { Language } from "@/lib/i18n";
import { focusSecurityCopy, pinErrorText } from "@/lib/focus-security-i18n";
import { experienceCopy } from "@/lib/experience-i18n";
import { sendCommand } from "@/data/extensionClient";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
export function TimeExtensionForm({
  pinRequired,
  language,
  refresh,
}: {
  pinRequired: boolean;
  language: Language;
  refresh: () => Promise<void>;
}) {
  const [pin, setPin] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const t = focusSecurityCopy(language);
  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          await sendCommand("EXTEND_TIME", { pin });
          await refresh();
        } catch (error) {
          setError(pinErrorText(error, language));
        } finally {
          setPin("");
          setBusy(false);
        }
      }}
    >
      {pinRequired && (
        <div className="space-y-1">
          <Label htmlFor="extension-pin">{t.pinRequired}</Label>
          <Input
            id="extension-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            pattern="[0-9]{4,8}"
            required
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            disabled={busy}
          />
        </div>
      )}
      <Button size="sm" disabled={busy} type="submit">
        {experienceCopy(language).extra}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
