import { ChromeStorageRepository } from '../data/ChromeStorageRepository';
import { BlockingService } from '../services/BlockingService';

const storageRepo = new ChromeStorageRepository();
const blockingService = new BlockingService(storageRepo);

let isBlocked = false;

function createOverlay() {
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

  const title = document.createElement('h1');
  title.innerText = "Time's Up!";
  title.style.fontSize = '3rem';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '1rem';
  
  const message = document.createElement('p');
  message.innerText = "You've reached your daily limit for this site.";
  message.style.fontSize = '1.2rem';
  message.style.color = '#a1a1aa';

  overlay.appendChild(title);
  overlay.appendChild(message);

  return overlay;
}

async function checkStatus() {
  if (isBlocked) return;

  const hostname = window.location.hostname;
  const shouldBlock = await blockingService.isBlocked(hostname);

  if (shouldBlock) {
    isBlocked = true;
    document.body.innerHTML = '';
    document.body.appendChild(createOverlay());
    document.body.style.overflow = 'hidden';
  }
}

// Initial check
checkStatus();

// Poll every 5 seconds (balance between responsiveness and performance)
setInterval(checkStatus, 5000);

// Also listen for storage changes (e.g. if limit updated in options)
chrome.storage.onChanged.addListener(() => {
  // Reset block state to re-evaluate
  // If we were blocked but limit increased, we need to reload to unblock really,
  // or at least remove overlay. 
  // For MVP: if blocked, we stay blocked until reload unless we implement unblock logic.
  // Let's implement unblock logic:
  
  if (isBlocked) {
     // Check again
     blockingService.isBlocked(window.location.hostname).then(stillBlocked => {
         if (!stillBlocked) {
             location.reload(); // Simplest way to restore content
         }
     });
  } else {
     checkStatus();
  }
});

