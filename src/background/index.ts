import { ChromeStorageRepository } from '../data/ChromeStorageRepository';
import { TimeTrackingService } from '../services/TimeTrackingService';

const storageRepo = new ChromeStorageRepository();
const trackingService = new TimeTrackingService(storageRepo);

// Debug flag - set to true for verbose logging
const DEBUG = true;

function log(...args: unknown[]) {
  if (DEBUG) {
    console.log('[WorkAround]', new Date().toISOString(), ...args);
  }
}

let activeTabId: number | null = null;
let activeHostname: string | null = null;
let startTime: number | null = null;

// Lock to prevent concurrent commits
let commitInProgress = false;

// Track tabs with media playing (for YouTube background detection)
const tabsWithAudio: Set<number> = new Set();

// Helper to extract hostname
function getHostname(url: string | undefined): string | null {
  if (!url) {
    log('getHostname: URL is empty/undefined');
    return null;
  }
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      log('getHostname: Extracted hostname:', u.hostname, 'from URL:', url.substring(0, 50));
      return u.hostname;
    }
    log('getHostname: Invalid protocol:', u.protocol);
    return null;
  } catch (e) {
    log('getHostname: Failed to parse URL:', url, e);
    return null;
  }
}

// Function to commit time for the currently active tab
async function commitCurrentSession(): Promise<boolean> {
  // Prevent concurrent commits
  if (commitInProgress) {
    log('⚠️ Commit already in progress, skipping');
    return false;
  }
  
  // Capture values atomically before any async operations
  const hostnameToCommit = activeHostname;
  const startTimeToCommit = startTime;
  
  log('commitCurrentSession called. hostname:', hostnameToCommit, 'startTime:', startTimeToCommit);
  
  if (!hostnameToCommit || !startTimeToCommit) {
    log('✗ Cannot commit: no hostname or startTime');
    return false;
  }
  
  // Calculate duration NOW, before resetting startTime
  const now = Date.now();
  const duration = now - startTimeToCommit;
  
  // Reset startTime immediately to prevent duplicate commits
  startTime = now;
  
  if (duration <= 500) {
    log(`✗ Duration too short (${duration}ms), skipping`);
    return false;
  }
  
  commitInProgress = true;
  
  try {
    log(`✓ Tracking ${duration}ms (${(duration/1000).toFixed(1)}s) for ${hostnameToCommit}`);
    await trackingService.trackTime(hostnameToCommit, duration);
    log(`✓ Saved successfully`);
    return true;
  } catch (e) {
    log('✗ Error saving:', e);
    return false;
  } finally {
    commitInProgress = false;
  }
}

// Get current session info (for popup to query)
function getCurrentSessionInfo() {
  const info = {
    hostname: activeHostname,
    currentSessionMs: activeHostname && startTime ? Date.now() - startTime : 0
  };
  return info;
}

async function handleTabSwitch(tabId: number, reason: string) {
  log(`handleTabSwitch called. tabId: ${tabId}, reason: ${reason}`);
  
  // Commit previous session before switching
  await commitCurrentSession();

  try {
    const tab = await chrome.tabs.get(tabId);
    log('Tab details:', { id: tab.id, url: tab.url?.substring(0, 60), audible: tab.audible, active: tab.active });
    
    const newHostname = getHostname(tab.url);
    
    // Only start tracking if it's a valid hostname
    if (newHostname) {
      activeTabId = tabId;
      activeHostname = newHostname;
      startTime = Date.now();
      log(`Now tracking: ${activeHostname} (tab ${tabId})`);
    } else {
      // Extension page or invalid - stop tracking
      activeTabId = tabId;
      activeHostname = null;
      startTime = null;
      log(`Not tracking (invalid hostname) for tab ${tabId}`);
    }
  } catch (e) {
    log('handleTabSwitch error (tab might be closed):', e);
    activeTabId = null;
    activeHostname = null;
    startTime = null;
  }
}

// Track audible tabs (for background media detection)
async function checkAudibleTabs() {
  try {
    const audibleTabs = await chrome.tabs.query({ audible: true });
    const newAudibleSet = new Set(audibleTabs.map(t => t.id).filter((id): id is number => id !== undefined));
    
    // Log changes in audible state
    for (const tabId of newAudibleSet) {
      if (!tabsWithAudio.has(tabId)) {
        const tab = await chrome.tabs.get(tabId);
        log(`🔊 Tab ${tabId} started playing audio: ${getHostname(tab.url)}`);
        tabsWithAudio.add(tabId);
      }
    }
    
    for (const tabId of tabsWithAudio) {
      if (!newAudibleSet.has(tabId)) {
        log(`🔇 Tab ${tabId} stopped playing audio`);
        tabsWithAudio.delete(tabId);
      }
    }
    
    // If there are audible tabs that are NOT the active tab, track them too
    for (const tab of audibleTabs) {
      if (tab.id && tab.id !== activeTabId) {
        const hostname = getHostname(tab.url);
        if (hostname) {
          // Track 1 minute for background audio (this is checked every minute)
          const duration = 60000;
          log(`📺 Background audio on: ${hostname} - tracking ${duration}ms`);
          await trackingService.trackTime(hostname, duration);
        }
      }
    }
  } catch (e) {
    log('checkAudibleTabs error:', e);
  }
}

// Event Listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  log('EVENT: tabs.onActivated - tabId:', activeInfo.tabId);
  await handleTabSwitch(activeInfo.tabId, 'tab activated');
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  log('EVENT: windows.onFocusChanged - windowId:', windowId);
  
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    log('Browser lost focus - committing and pausing');
    await commitCurrentSession();
    // Pause tracking (keep hostname but clear startTime)
    startTime = null;
  } else {
    log('Browser focused - resuming');
    // Resume tracking if we had a hostname
    if (activeHostname) {
      startTime = Date.now();
      log(`Resumed tracking: ${activeHostname}`);
    } else {
      // Find active tab
      const tabs = await chrome.tabs.query({ active: true, windowId });
      if (tabs.length > 0 && tabs[0].id) {
        await handleTabSwitch(tabs[0].id, 'window focused');
      }
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only log important updates
  if (tabId === activeTabId && (changeInfo.url || changeInfo.status === 'complete')) {
    log('EVENT: tabs.onUpdated - tabId:', tabId, 'changes:', changeInfo);
  }
  
  // Track URL changes on the active tab (for SPAs like Instagram)
  if (tabId === activeTabId && changeInfo.url) {
    const newHostname = getHostname(changeInfo.url);
    log(`Active tab URL changed from ${activeHostname} to ${newHostname}`);
    
    if (newHostname && newHostname !== activeHostname) {
      log('Hostname changed - committing and switching');
      await commitCurrentSession();
      activeHostname = newHostname;
      startTime = Date.now();
    }
  }
});

// Periodic heartbeat to save progress and check background audio
chrome.alarms.create('heartbeat', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'heartbeat') {
    log('⏰ HEARTBEAT');
    await commitCurrentSession();
    await checkAudibleTabs();
    // Proactively clean up stale data from previous days
    await storageRepo.cleanupOldStats();
  }
});

// Message handler for popup to get current session info
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CURRENT_SESSION') {
    const info = getCurrentSessionInfo();
    sendResponse(info);
    return true;
  }
  
  if (message.type === 'DEBUG_STATE') {
    sendResponse({
      activeTabId,
      activeHostname,
      startTime,
      currentDuration: startTime ? Date.now() - startTime : 0,
      tabsWithAudio: Array.from(tabsWithAudio),
      commitInProgress
    });
    return true;
  }
});

// Initialize on startup
async function initialize() {
  log('🚀 Background worker starting...');
  
  // Clean up stale data from previous days on startup
  await storageRepo.cleanupOldStats();
  
  // Find currently active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0 && tabs[0].id) {
    await handleTabSwitch(tabs[0].id, 'startup');
  }
  
  log('✅ Background worker initialized');
}

initialize();
