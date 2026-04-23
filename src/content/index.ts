import { ChromeStorageRepository } from '../data/ChromeStorageRepository';
import { BlockingService } from '../services/BlockingService';
import { BlockReason } from '../domain/models';

const storageRepo = new ChromeStorageRepository();
const blockingService = new BlockingService(storageRepo);

const LANGUAGE_KEY = 'workaround_language';

let isBlocked = false;

type Language = 'en' | 'pl' | 'de' | 'es' | 'fr';

interface BlockMessage {
  title: string;
  message: string;
  returnButton?: string;
}

const blockMessages: Record<Language, Record<BlockReason, BlockMessage>> = {
  en: {
    none: { title: '', message: '' },
    time_limit: { title: "Time's Up!", message: "You've reached your daily limit for this site." },
    outside_hours: { title: "Not Available Yet", message: "This site is only accessible during your allowed hours." },
    focus_mode: { title: "Focus Mode Active", message: "All sites are blocked during Focus Mode." },
    youtube_shorts: { title: "Shorts Blocked", message: "YouTube Shorts are blocked to help you stay focused.", returnButton: "Return to YouTube" },
  },
  pl: {
    none: { title: '', message: '' },
    time_limit: { title: "Czas minął!", message: "Osiągnięto dzienny limit dla tej strony." },
    outside_hours: { title: "Jeszcze niedostępne", message: "Ta strona jest dostępna tylko w dozwolonych godzinach." },
    focus_mode: { title: "Tryb skupienia aktywny", message: "Wszystkie strony są zablokowane w trybie skupienia." },
    youtube_shorts: { title: "Shortsy zablokowane", message: "YouTube Shorts są zablokowane, aby pomóc Ci się skupić.", returnButton: "Wróć do YouTube" },
  },
  de: {
    none: { title: '', message: '' },
    time_limit: { title: "Zeit abgelaufen!", message: "Du hast dein tägliches Limit für diese Seite erreicht." },
    outside_hours: { title: "Noch nicht verfügbar", message: "Diese Seite ist nur während der erlaubten Stunden zugänglich." },
    focus_mode: { title: "Fokusmodus aktiv", message: "Alle Seiten sind während des Fokusmodus gesperrt." },
    youtube_shorts: { title: "Shorts blockiert", message: "YouTube Shorts sind blockiert, um dir zu helfen, fokussiert zu bleiben.", returnButton: "Zurück zu YouTube" },
  },
  es: {
    none: { title: '', message: '' },
    time_limit: { title: "¡Se acabó el tiempo!", message: "Has alcanzado tu límite diario para este sitio." },
    outside_hours: { title: "Aún no disponible", message: "Este sitio solo es accesible durante las horas permitidas." },
    focus_mode: { title: "Modo enfoque activo", message: "Todos los sitios están bloqueados durante el modo enfoque." },
    youtube_shorts: { title: "Shorts bloqueados", message: "Los YouTube Shorts están bloqueados para ayudarte a concentrarte.", returnButton: "Volver a YouTube" },
  },
  fr: {
    none: { title: '', message: '' },
    time_limit: { title: "Temps écoulé !", message: "Vous avez atteint votre limite quotidienne pour ce site." },
    outside_hours: { title: "Pas encore disponible", message: "Ce site n'est accessible que pendant vos heures autorisées." },
    focus_mode: { title: "Mode focus actif", message: "Tous les sites sont bloqués pendant le mode focus." },
    youtube_shorts: { title: "Shorts bloqués", message: "Les YouTube Shorts sont bloqués pour vous aider à rester concentré.", returnButton: "Retour à YouTube" },
  },
};

async function getLanguage(): Promise<Language> {
  return new Promise((resolve) => {
    chrome.storage.sync.get([LANGUAGE_KEY], (result) => {
      const lang = result[LANGUAGE_KEY] as Language | undefined;
      if (lang && lang in blockMessages) {
        resolve(lang);
      } else {
        // Detect from browser
        const browserLang = navigator.language.split('-')[0].toLowerCase();
        if (browserLang in blockMessages) {
          resolve(browserLang as Language);
        } else {
          resolve('en');
        }
      }
    });
  });
}

function getBlockMessage(reason: BlockReason, lang: Language): BlockMessage {
  return blockMessages[lang][reason] || blockMessages.en[reason];
}

function createOverlay(reason: BlockReason, lang: Language) {
  const blockMessage = getBlockMessage(reason, lang);
  const { title, message } = blockMessage;
  
  const overlay = document.createElement('div');
  overlay.id = 'workaround-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = '#09090b';
  overlay.style.zIndex = '2147483647';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.color = '#fafafa';
  overlay.style.fontFamily = 'system-ui, -apple-system, sans-serif';

  const titleEl = document.createElement('h1');
  titleEl.innerText = title;
  titleEl.style.fontSize = '3rem';
  titleEl.style.fontWeight = 'bold';
  titleEl.style.marginBottom = '1rem';
  
  const messageEl = document.createElement('p');
  messageEl.innerText = message;
  messageEl.style.fontSize = '1.2rem';
  messageEl.style.color = '#a1a1aa';

  // Add icon based on reason
  const iconEl = document.createElement('div');
  iconEl.style.fontSize = '4rem';
  iconEl.style.marginBottom = '1rem';
  
  switch (reason) {
    case 'time_limit':
      iconEl.innerText = '⏰';
      break;
    case 'outside_hours':
      iconEl.innerText = '🕐';
      break;
    case 'focus_mode':
      iconEl.innerText = '🎯';
      break;
    case 'youtube_shorts':
      iconEl.innerText = '📵';
      break;
    default:
      iconEl.innerText = '🚫';
  }

  overlay.appendChild(iconEl);
  overlay.appendChild(titleEl);
  overlay.appendChild(messageEl);

  // Add return button for YouTube Shorts
  if (reason === 'youtube_shorts' && blockMessage.returnButton) {
    const buttonEl = document.createElement('button');
    buttonEl.innerText = blockMessage.returnButton;
    buttonEl.style.marginTop = '2rem';
    buttonEl.style.padding = '0.75rem 2rem';
    buttonEl.style.fontSize = '1rem';
    buttonEl.style.fontWeight = '600';
    buttonEl.style.backgroundColor = '#ef4444';
    buttonEl.style.color = '#fff';
    buttonEl.style.border = 'none';
    buttonEl.style.borderRadius = '0.5rem';
    buttonEl.style.cursor = 'pointer';
    buttonEl.style.transition = 'background-color 0.2s';
    buttonEl.onmouseenter = () => buttonEl.style.backgroundColor = '#dc2626';
    buttonEl.onmouseleave = () => buttonEl.style.backgroundColor = '#ef4444';
    buttonEl.onclick = () => {
      window.location.href = 'https://www.youtube.com';
    };
    overlay.appendChild(buttonEl);
  }

  return overlay;
}

async function checkStatus() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  const reason = await blockingService.getBlockReason(hostname, pathname);

  if (reason !== 'none') {
    if (!isBlocked) {
      // Just became blocked — show overlay
      isBlocked = true;
      const lang = await getLanguage();
      document.body.innerHTML = '';
      document.body.appendChild(createOverlay(reason, lang));
      document.body.style.overflow = 'hidden';
    }
  } else if (isBlocked) {
    // Was blocked, but now unblocked (e.g., new day, settings changed)
    isBlocked = false;
    location.reload();
  }
}

// Initial check
checkStatus();

// Poll every second for URL changes (YouTube SPA navigation)
setInterval(checkStatus, 1000);

// Listen for history navigation (back/forward buttons)
window.addEventListener('popstate', () => {
  checkStatus();
});

// Monkey-patch pushState and replaceState for SPA navigation detection
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  originalPushState.apply(this, args);
  checkStatus();
};

history.replaceState = function(...args) {
  originalReplaceState.apply(this, args);
  checkStatus();
};

// Listen for storage changes
chrome.storage.onChanged.addListener(() => {
  checkStatus();
});
