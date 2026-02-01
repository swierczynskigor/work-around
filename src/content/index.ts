import { ChromeStorageRepository } from '../data/ChromeStorageRepository';
import { BlockingService } from '../services/BlockingService';
import { BlockReason } from '../domain/models';

const storageRepo = new ChromeStorageRepository();
const blockingService = new BlockingService(storageRepo);

let isBlocked = false;

interface BlockMessage {
  title: string;
  message: string;
}

function getBlockMessage(reason: BlockReason): BlockMessage {
  switch (reason) {
    case 'time_limit':
      return {
        title: "Time's Up!",
        message: "You've reached your daily limit for this site."
      };
    case 'outside_hours':
      return {
        title: "Not Available Yet",
        message: "This site is only accessible during your allowed hours."
      };
    case 'focus_mode':
      return {
        title: "Focus Mode Active",
        message: "All sites are blocked during Focus Mode."
      };
    default:
      return {
        title: "Blocked",
        message: "This site is currently blocked."
      };
  }
}

function createOverlay(reason: BlockReason) {
  const { title, message } = getBlockMessage(reason);
  
  const overlay = document.createElement('div');
  overlay.id = 'workaround-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = '#09090b'; // dark zinc
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
    document.body.innerHTML = '';
    document.body.appendChild(createOverlay(reason));
    document.body.style.overflow = 'hidden';
  }
}

// Initial check
checkStatus();

// Poll every 5 seconds (balance between responsiveness and performance)
setInterval(checkStatus, 5000);

// Also listen for storage changes (e.g. if limit updated in options)
chrome.storage.onChanged.addListener(() => {
  if (isBlocked) {
     // Check again
     blockingService.getBlockReason(window.location.hostname).then(reason => {
         if (reason === 'none') {
             location.reload(); // Simplest way to restore content
         }
     });
  } else {
     checkStatus();
  }
});
