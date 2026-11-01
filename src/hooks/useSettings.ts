"use client";
import { useState, useEffect, useCallback } from "react";
import { AppSettings } from "@/domain/models";
import {
  ChromeStorageRepository,
  SETTINGS_KEY,
} from "@/data/ChromeStorageRepository";
import { isExtension } from "@/data/extensionClient";
import { DEFAULT_SETTINGS } from "@/services/policies";
const repository = new ChromeStorageRepository();
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [extension, setExtension] = useState(false);
  useEffect(() => {
    if (!isExtension()) {
      void Promise.resolve().then(() => setLoading(false));
      return;
    }
    const load = () =>
      repository
        .getSettings()
        .then((value) => {
          setSettings(value);
          setExtension(true);
        })
        .catch((error) => setError(String(error)))
        .finally(() => setLoading(false));
    void load();
    const changed = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === "sync" && changes[SETTINGS_KEY]) void load();
    };
    chrome.storage.onChanged.addListener(changed);
    return () => chrome.storage.onChanged.removeListener(changed);
  }, []);
  const saveSettings = useCallback(async (value: AppSettings) => {
    if (!isExtension()) {
      setSettings(value);
      return true;
    }
    try {
      await repository.saveSettings(value);
      setSettings(value);
      setError("");
      return true;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to save settings.",
      );
      return false;
    }
  }, []);
  return { settings, loading, saveSettings, error, isExtension: extension };
}
