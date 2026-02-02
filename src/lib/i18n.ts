/**
 * Internationalization (i18n) system for WorkAround extension
 * Supported languages: English, Polish, German, Spanish, French
 */

export type Language = 'en' | 'pl' | 'de' | 'es' | 'fr';

export interface Translations {
  popup: {
    title: string;
    currentSite: string;
    topSitesToday: string;
    noStats: string;
    goToOptions: string;
    notValidSite: string;
    noActivity: string;
    today: string;
    noLimit: string;
    remaining: string;
    used: string;
    limit: string;
  };
  options: {
    title: string;
    subtitle: string;
    notInExtension: string;
    general: string;
    enableTracking: string;
    dailyLimits: string;
    addButton: string;
    minutes: string;
    minPerDay: string;
    noLimits: string;
    allowedHours: string;
    addWindow: string;
    save: string;
    cancel: string;
    to: string;
    tabLimits: string;
    tabSettings: string;
  };
  settings: {
    title: string;
    language: string;
    theme: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
  };
  block: {
    timesUp: string;
    timesUpMessage: string;
    notAvailable: string;
    notAvailableMessage: string;
    focusMode: string;
    focusModeMessage: string;
  };
  common: {
    delete: string;
    edit: string;
  };
}

const translations: Record<Language, Translations> = {
  en: {
    popup: {
      title: "WorkAround",
      currentSite: "Current Site",
      topSitesToday: "Top Sites Today",
      noStats: "No stats for",
      goToOptions: "Go to Options to set a limit.",
      notValidSite: "Not a valid site to track",
      noActivity: "No activity recorded yet",
      today: "Today",
      noLimit: "No limit set",
      remaining: "Remaining",
      used: "used",
      limit: "Limit",
    },
    options: {
      title: "WorkAround Settings",
      subtitle: "Manage your productivity rules",
      notInExtension: "Not running in extension context. Settings won't be saved.",
      general: "General",
      enableTracking: "Enable Time Tracking",
      dailyLimits: "Daily Limits",
      addButton: "Add",
      minutes: "Minutes",
      minPerDay: "min/day",
      noLimits: "No limits defined. Add a domain above to get started.",
      allowedHours: "Allowed Hours",
      addWindow: "Add Window",
      save: "Save",
      cancel: "Cancel",
      to: "to",
      tabLimits: "Limits",
      tabSettings: "Settings",
    },
    settings: {
      title: "Extension Settings",
      language: "Language",
      theme: "Theme",
      themeLight: "Light",
      themeDark: "Dark",
      themeSystem: "System",
    },
    block: {
      timesUp: "Time's Up!",
      timesUpMessage: "You've reached your daily limit for this site.",
      notAvailable: "Not Available Yet",
      notAvailableMessage: "This site is only accessible during your allowed hours.",
      focusMode: "Focus Mode Active",
      focusModeMessage: "All sites are blocked during Focus Mode.",
    },
    common: {
      delete: "Delete",
      edit: "Edit",
    },
  },
  pl: {
    popup: {
      title: "WorkAround",
      currentSite: "Bieżąca strona",
      topSitesToday: "Top strony dziś",
      noStats: "Brak statystyk dla",
      goToOptions: "Przejdź do Ustawień aby dodać limit.",
      notValidSite: "Nieprawidłowa strona do śledzenia",
      noActivity: "Brak zarejestrowanej aktywności",
      today: "Dziś",
      noLimit: "Brak limitu",
      remaining: "Pozostało",
      used: "wykorzystane",
      limit: "Limit",
    },
    options: {
      title: "Ustawienia WorkAround",
      subtitle: "Zarządzaj regułami produktywności",
      notInExtension: "Nie działa w kontekście rozszerzenia. Ustawienia nie zostaną zapisane.",
      general: "Ogólne",
      enableTracking: "Włącz śledzenie czasu",
      dailyLimits: "Dzienne limity",
      addButton: "Dodaj",
      minutes: "Minuty",
      minPerDay: "min/dzień",
      noLimits: "Brak zdefiniowanych limitów. Dodaj domenę powyżej.",
      allowedHours: "Dozwolone godziny",
      addWindow: "Dodaj okno",
      save: "Zapisz",
      cancel: "Anuluj",
      to: "do",
      tabLimits: "Limity",
      tabSettings: "Ustawienia",
    },
    settings: {
      title: "Ustawienia rozszerzenia",
      language: "Język",
      theme: "Motyw",
      themeLight: "Jasny",
      themeDark: "Ciemny",
      themeSystem: "Systemowy",
    },
    block: {
      timesUp: "Czas minął!",
      timesUpMessage: "Osiągnięto dzienny limit dla tej strony.",
      notAvailable: "Jeszcze niedostępne",
      notAvailableMessage: "Ta strona jest dostępna tylko w dozwolonych godzinach.",
      focusMode: "Tryb skupienia aktywny",
      focusModeMessage: "Wszystkie strony są zablokowane w trybie skupienia.",
    },
    common: {
      delete: "Usuń",
      edit: "Edytuj",
    },
  },
  de: {
    popup: {
      title: "WorkAround",
      currentSite: "Aktuelle Seite",
      topSitesToday: "Top-Seiten heute",
      noStats: "Keine Statistiken für",
      goToOptions: "Gehe zu Einstellungen um ein Limit festzulegen.",
      notValidSite: "Keine gültige Seite zum Verfolgen",
      noActivity: "Noch keine Aktivität aufgezeichnet",
      today: "Heute",
      noLimit: "Kein Limit gesetzt",
      remaining: "Verbleibend",
      used: "verwendet",
      limit: "Limit",
    },
    options: {
      title: "WorkAround Einstellungen",
      subtitle: "Verwalte deine Produktivitätsregeln",
      notInExtension: "Nicht im Erweiterungskontext. Einstellungen werden nicht gespeichert.",
      general: "Allgemein",
      enableTracking: "Zeiterfassung aktivieren",
      dailyLimits: "Tägliche Limits",
      addButton: "Hinzufügen",
      minutes: "Minuten",
      minPerDay: "Min/Tag",
      noLimits: "Keine Limits definiert. Füge oben eine Domain hinzu.",
      allowedHours: "Erlaubte Stunden",
      addWindow: "Fenster hinzufügen",
      save: "Speichern",
      cancel: "Abbrechen",
      to: "bis",
      tabLimits: "Limits",
      tabSettings: "Einstellungen",
    },
    settings: {
      title: "Erweiterungseinstellungen",
      language: "Sprache",
      theme: "Thema",
      themeLight: "Hell",
      themeDark: "Dunkel",
      themeSystem: "System",
    },
    block: {
      timesUp: "Zeit abgelaufen!",
      timesUpMessage: "Du hast dein tägliches Limit für diese Seite erreicht.",
      notAvailable: "Noch nicht verfügbar",
      notAvailableMessage: "Diese Seite ist nur während der erlaubten Stunden zugänglich.",
      focusMode: "Fokusmodus aktiv",
      focusModeMessage: "Alle Seiten sind während des Fokusmodus gesperrt.",
    },
    common: {
      delete: "Löschen",
      edit: "Bearbeiten",
    },
  },
  es: {
    popup: {
      title: "WorkAround",
      currentSite: "Sitio actual",
      topSitesToday: "Top sitios hoy",
      noStats: "Sin estadísticas para",
      goToOptions: "Ve a Opciones para establecer un límite.",
      notValidSite: "No es un sitio válido para rastrear",
      noActivity: "Sin actividad registrada aún",
      today: "Hoy",
      noLimit: "Sin límite establecido",
      remaining: "Restante",
      used: "usado",
      limit: "Límite",
    },
    options: {
      title: "Configuración de WorkAround",
      subtitle: "Gestiona tus reglas de productividad",
      notInExtension: "No se ejecuta en contexto de extensión. La configuración no se guardará.",
      general: "General",
      enableTracking: "Habilitar seguimiento de tiempo",
      dailyLimits: "Límites diarios",
      addButton: "Agregar",
      minutes: "Minutos",
      minPerDay: "min/día",
      noLimits: "No hay límites definidos. Agrega un dominio arriba.",
      allowedHours: "Horas permitidas",
      addWindow: "Agregar ventana",
      save: "Guardar",
      cancel: "Cancelar",
      to: "a",
      tabLimits: "Límites",
      tabSettings: "Configuración",
    },
    settings: {
      title: "Configuración de extensión",
      language: "Idioma",
      theme: "Tema",
      themeLight: "Claro",
      themeDark: "Oscuro",
      themeSystem: "Sistema",
    },
    block: {
      timesUp: "¡Se acabó el tiempo!",
      timesUpMessage: "Has alcanzado tu límite diario para este sitio.",
      notAvailable: "Aún no disponible",
      notAvailableMessage: "Este sitio solo es accesible durante las horas permitidas.",
      focusMode: "Modo enfoque activo",
      focusModeMessage: "Todos los sitios están bloqueados durante el modo enfoque.",
    },
    common: {
      delete: "Eliminar",
      edit: "Editar",
    },
  },
  fr: {
    popup: {
      title: "WorkAround",
      currentSite: "Site actuel",
      topSitesToday: "Top sites aujourd'hui",
      noStats: "Pas de stats pour",
      goToOptions: "Allez dans Options pour définir une limite.",
      notValidSite: "Site non valide à suivre",
      noActivity: "Aucune activité enregistrée",
      today: "Aujourd'hui",
      noLimit: "Aucune limite définie",
      remaining: "Restant",
      used: "utilisé",
      limit: "Limite",
    },
    options: {
      title: "Paramètres WorkAround",
      subtitle: "Gérez vos règles de productivité",
      notInExtension: "Non exécuté dans le contexte d'extension. Les paramètres ne seront pas sauvegardés.",
      general: "Général",
      enableTracking: "Activer le suivi du temps",
      dailyLimits: "Limites quotidiennes",
      addButton: "Ajouter",
      minutes: "Minutes",
      minPerDay: "min/jour",
      noLimits: "Aucune limite définie. Ajoutez un domaine ci-dessus.",
      allowedHours: "Heures autorisées",
      addWindow: "Ajouter fenêtre",
      save: "Sauvegarder",
      cancel: "Annuler",
      to: "à",
      tabLimits: "Limites",
      tabSettings: "Paramètres",
    },
    settings: {
      title: "Paramètres d'extension",
      language: "Langue",
      theme: "Thème",
      themeLight: "Clair",
      themeDark: "Sombre",
      themeSystem: "Système",
    },
    block: {
      timesUp: "Temps écoulé !",
      timesUpMessage: "Vous avez atteint votre limite quotidienne pour ce site.",
      notAvailable: "Pas encore disponible",
      notAvailableMessage: "Ce site n'est accessible que pendant vos heures autorisées.",
      focusMode: "Mode focus actif",
      focusModeMessage: "Tous les sites sont bloqués pendant le mode focus.",
    },
    common: {
      delete: "Supprimer",
      edit: "Modifier",
    },
  },
};

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  pl: 'Polski',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
};

export function getTranslations(lang: Language): Translations {
  return translations[lang] || translations.en;
}

export function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const browserLang = navigator.language.split('-')[0].toLowerCase();
  if (browserLang in translations) {
    return browserLang as Language;
  }
  return 'en';
}

export default translations;
