"use client";

import { useState, useEffect, useCallback } from 'react';
import { Language, Translations, getTranslations, detectBrowserLanguage, LANGUAGE_NAMES } from '@/lib/i18n';

const LANGUAGE_KEY = 'workaround_language';
const THEME_KEY = 'workaround_theme';

export type Theme = 'light' | 'dark' | 'system';

// Helper to safely check if we're in a Chrome extension context
function isChromeExtension(): boolean {
  try {
    return typeof chrome !== 'undefined' && 
           typeof chrome.storage !== 'undefined' &&
           typeof chrome.storage.sync !== 'undefined';
  } catch {
    return false;
  }
}

function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return;
  
  const root = document.documentElement;
  
  if (theme === 'system') {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', systemDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

export function useI18n() {
  const [language, setLanguageState] = useState<Language>('en');
  const [theme, setThemeState] = useState<Theme>('system');
  const [t, setT] = useState<Translations>(getTranslations('en'));

  useEffect(() => {
    // Load saved preferences or detect from browser/system
    if (isChromeExtension()) {
      chrome.storage.sync.get([LANGUAGE_KEY, THEME_KEY], (result) => {
        if (chrome.runtime.lastError) {
          const detected = detectBrowserLanguage();
          setLanguageState(detected);
          setT(getTranslations(detected));
          applyTheme('system');
          return;
        }
        
        // Language
        const savedLang = result[LANGUAGE_KEY] as Language | undefined;
        const lang = savedLang || detectBrowserLanguage();
        setLanguageState(lang);
        setT(getTranslations(lang));
        
        // Theme
        const savedTheme = result[THEME_KEY] as Theme | undefined;
        const themeValue = savedTheme || 'system';
        setThemeState(themeValue);
        applyTheme(themeValue);
      });
    } else {
      const detected = detectBrowserLanguage();
      setLanguageState(detected);
      setT(getTranslations(detected));
      applyTheme('system');
    }
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // Re-apply if using system theme
      if (isChromeExtension()) {
        chrome.storage.sync.get([THEME_KEY], (result) => {
          const currentTheme = result[THEME_KEY] as Theme | undefined;
          if (!currentTheme || currentTheme === 'system') {
            applyTheme('system');
          }
        });
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    setT(getTranslations(lang));
    
    if (isChromeExtension()) {
      chrome.storage.sync.set({ [LANGUAGE_KEY]: lang });
    }
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    
    if (isChromeExtension()) {
      chrome.storage.sync.set({ [THEME_KEY]: newTheme });
    }
  }, []);

  return { 
    language, 
    setLanguage, 
    theme,
    setTheme,
    t,
    availableLanguages: LANGUAGE_NAMES
  };
}
