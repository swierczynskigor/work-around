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
}

const blockMessages: Record<Language, Record<BlockReason, BlockMessage>> = {
  en: {
    none: { title: '', message: '' },
    time_limit: { title: "Time's Up!", message: "You've reached your daily limit for this site." },
    outside_hours: { title: "Not Available Yet", message: "This site is only accessible during your allowed hours." },
    focus_mode: { title: "Focus Mode Active", message: "All sites are blocked during Focus Mode." },
  },
  pl: {
    none: { title: '', message: '' },
    time_limit: { title: "Czas minął!", message: "Osiągnięto dzienny limit dla tej strony." },
    outside_hours: { title: "Jeszcze niedostępne", message: "Ta strona jest dostępna tylko w dozwolonych godzinach." },
    focus_mode: { title: "Tryb skupienia aktywny", message: "Wszystkie strony są zablokowane w trybie skupienia." },
  },
  de: {
    none: { title: '', message: '' },
    time_limit: { title: "Zeit abgelaufen!", message: "Du hast dein tägliches Limit für diese Seite erreicht." },
    outside_hours: { title: "Noch nicht verfügbar", message: "Diese Seite ist nur während der erlaubten Stunden zugänglich." },
    focus_mode: { title: "Fokusmodus aktiv", message: "Alle Seiten sind während des Fokusmodus gesperrt." },
  },
  es: {
    none: { title: '', message: '' },
    time_limit: { title: "¡Se acabó el tiempo!", message: "Has alcanzado tu límite diario para este sitio." },
    outside_hours: { title: "Aún no disponible", message: "Este sitio solo es accesible durante las horas permitidas." },
    focus_mode: { title: "Modo enfoque activo", message: "Todos los sitios están bloqueados durante el modo enfoque." },
  },
  fr: {
    none: { title: '', message: '' },
    time_limit: { title: "Temps écoulé !", message: "Vous avez atteint votre limite quotidienne pour ce site." },
    outside_hours: { title: "Pas encore disponible", message: "Ce site n'est accessible que pendant vos heures autorisées." },
    focus_mode: { title: "Mode focus actif", message: "Tous les sites sont bloqués pendant le mode focus." },
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
  const { title, message } = getBlockMessage(reason, lang);
  
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
    default:
      iconEl.innerText = '🚫';
  }

  overlay.appendChild(iconEl);
  overlay.appendChild(titleEl);
  overlay.appendChild(messageEl);

  return overlay;
}

async function checkStatus() {
  if (isBlocked) return;

  const hostname = window.location.hostname;
  const reason = await blockingService.getBlockReason(hostname);

  if (reason !== 'none') {
    isBlocked = true;
    const lang = await getLanguage();
    document.body.innerHTML = '';
    document.body.appendChild(createOverlay(reason, lang));
    document.body.style.overflow = 'hidden';
  }
}

// Initial check
checkStatus();

// Poll every 5 seconds
setInterval(checkStatus, 5000);

// Listen for storage changes
chrome.storage.onChanged.addListener(() => {
  if (isBlocked) {
     blockingService.getBlockReason(window.location.hostname).then(reason => {
         if (reason === 'none') {
             location.reload();
         }
     });
  } else {
     checkStatus();
  }
});
