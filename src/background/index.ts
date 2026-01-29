import { ChromeStorageRepository } from '../data/ChromeStorageRepository';
import { TimeTrackingService } from '../services/TimeTrackingService';

const storageRepo = new ChromeStorageRepository();
const trackingService = new TimeTrackingService(storageRepo);

let activeTabId: number | null = null;
let activeHostname: string | null = null;
let startTime: number | null = null;

// Helper to extract hostname
function getHostname(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return u.hostname;
    }
    return null;
  } catch {
    return null;
  }
}

// Function to commit time for the currently active tab
async function commitCurrentSession() {
  if (activeHostname && startTime) {
    const now = Date.now();
    const duration = now - startTime;
    if (duration > 0) {
      console.log(`Tracking ${duration}ms for ${activeHostname}`);
      await trackingService.trackTime(activeHostname, duration);
    }
  }
  startTime = Date.now();
}

async function handleTabSwitch(tabId: number) {
  await commitCurrentSession();

  try {
    const tab = await chrome.tabs.get(tabId);
    activeTabId = tabId;
    activeHostname = getHostname(tab.url);
    startTime = Date.now();
  } catch (e) {
    // Tab might be closed or invalid
    activeTabId = null;
    activeHostname = null;
    startTime = null;
  }
}

// Event Listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await handleTabSwitch(activeInfo.tabId);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus, stop tracking
    await commitCurrentSession();
    activeTabId = null;
    activeHostname = null;
    startTime = null;
  } else {
    // Browser focused, find active tab in this window
    const tabs = await chrome.tabs.query({ active: true, windowId });
    if (tabs.length > 0 && tabs[0].id) {
      await handleTabSwitch(tabs[0].id);
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.status === 'complete') {
    // URL changed in active tab
    await commitCurrentSession();
    activeHostname = getHostname(tab.url);
    startTime = Date.now();
  }
});

// Periodic heartbeat to save progress and preventing data loss on SW termination
chrome.alarms.create('heartbeat', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'heartbeat') {
    await commitCurrentSession();
  }
});

console.log('Background worker started');

