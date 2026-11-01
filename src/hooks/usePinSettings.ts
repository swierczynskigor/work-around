"use client";
import { useCallback, useEffect, useState } from "react";
import { PinStatus } from "@/domain/models";
import { isExtension, sendCommand } from "@/data/extensionClient";
import { PIN_KEY } from "@/data/ChromeStorageRepository";

export function usePinSettings() {
  const [status, setStatus] = useState<PinStatus | null>(null);
  const [error, setError] = useState<unknown>(null);
  const reload = useCallback(async () => {
    try {
      setStatus(await sendCommand<PinStatus>("GET_PIN_STATUS"));
      setError(null);
    } catch (error) {
      setError(error);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(reload);
    if (!isExtension()) return;
    const changed = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === "local" && changes[PIN_KEY]) void reload();
    };
    chrome.storage.onChanged.addListener(changed);
    return () => chrome.storage.onChanged.removeListener(changed);
  }, [reload]);
  async function save(payload: Record<string, unknown>, remove = false) {
    const result = await sendCommand<PinStatus>(
      remove ? "REMOVE_PIN" : "CONFIGURE_PIN",
      payload,
    );
    setStatus(result);
    return result;
  }
  return { status, error, save };
}
