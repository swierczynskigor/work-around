"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Language,
  getTranslations,
  detectBrowserLanguage,
  LANGUAGE_NAMES,
} from "@/lib/i18n";
import { ChromeStorageRepository } from "@/data/ChromeStorageRepository";
import { isExtension } from "@/data/extensionClient";
export type Theme = "light" | "dark" | "system";
const repository = new ChromeStorageRepository();
function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle(
    "dark",
    theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches),
  );
}
export function useI18n() {
  const [language, setLanguageState] = useState<Language>("en");
  const [theme, setThemeState] = useState<Theme>("system");
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const preferences = isExtension()
        ? await repository.getPreferences()
        : {};
      if (!alive) return;
      const language = preferences.language || detectBrowserLanguage();
      setLanguageState(language);
      setThemeState(preferences.theme || "system");
    };
    void load().catch(() => {
      if (alive) setLanguageState(detectBrowserLanguage());
    });
    const changed = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (
        area === "sync" &&
        (changes.workaround_language || changes.workaround_theme)
      )
        void load();
    };
    if (isExtension()) chrome.storage.onChanged.addListener(changed);
    return () => {
      alive = false;
      if (isExtension()) chrome.storage.onChanged.removeListener(changed);
    };
  }, []);
  useEffect(() => {
    applyTheme(theme);
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const changed = () => applyTheme(theme);
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const setLanguage = useCallback((language: Language) => {
    setLanguageState(language);
    if (isExtension()) void repository.savePreferences({ language });
  }, []);
  const setTheme = useCallback((theme: Theme) => {
    setThemeState(theme);
    if (isExtension()) void repository.savePreferences({ theme });
  }, []);
  return {
    language,
    setLanguage,
    theme,
    setTheme,
    t: getTranslations(language),
    availableLanguages: LANGUAGE_NAMES,
  };
}
