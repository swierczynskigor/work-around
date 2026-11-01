import {
  PinError,
  PinService,
  pinStatus,
  requiresPin,
} from "../services/PinService";
import {
  ChromeStorageRepository,
  SETTINGS_KEY,
  USAGE_KEY,
  PIN_KEY,
} from "../data/ChromeStorageRepository";
import {
  AppSettings,
  CurrentSessionInfo,
  PolicyDecision,
  PinState,
  TrackingStatus,
  UsageData,
} from "../domain/models";
import {
  ActivityTarget,
  ActivityTracker,
  MAX_SAMPLE_GAP_MS,
} from "../services/ActivityTracker";
import {
  DEFAULT_SETTINGS,
  dayKey,
  evaluatePolicy,
  hostnameFromUrl,
} from "../services/policies";

const repository = new ChromeStorageRepository();
const tracker = new ActivityTracker();
const pins = new PinService(repository);
let pinState: PinState | null = null;
let settings: AppSettings = DEFAULT_SETTINGS;
let usage: UsageData = { version: 2, records: [], extensions: [] };
let pausedUntil: number | null = null;
let status: TrackingStatus = "unsupported";
let activeUrl = "";
let lastSampleAt = 0;
const media = new Map<number, { playing: boolean; at: number }>();
interface Gate {
  url: string;
  elapsed: number;
  lastAt: number;
  passed: boolean;
}
const gates = new Map<number, Gate>();

async function initialize() {
  await repository.migrate();
  [settings, usage] = await Promise.all([
    repository.getSettings(),
    repository.getUsage(),
  ]);
  pinState = await repository.getPinState();
  const session = await repository.getSession<{
    pausedUntil?: number | null;
  }>();
  pausedUntil =
    session?.pausedUntil && session.pausedUntil > Date.now()
      ? session.pausedUntil
      : null;
  chrome.idle.setDetectionInterval(settings.idleSeconds || 180);
  if (!(await chrome.alarms.get("heartbeat")))
    await chrome.alarms.create("heartbeat", { periodInMinutes: 0.5 });
  // A restarted worker must observe activity again, never commit the old wall-clock gap.
  tracker.reset();
}
let queue: Promise<unknown> = initialize();
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = queue.then(operation);
  queue = next.catch((error) => {
    if (!(error instanceof PinError)) console.error("[WorkAround]", error);
  });
  return next;
}
function decision(url: string, now = Date.now()): PolicyDecision {
  return {
    ...evaluatePolicy(url, settings, usage, now),
    pinRequired: requiresPin(hostnameFromUrl(url), pinState),
  };
}

async function sample(force = false, closePrevious = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastSampleAt < 4000) return;
  lastSampleAt = now;
  const [windows, idle] = await Promise.all([
    chrome.windows.getAll({ populate: true, windowTypes: ["normal"] }),
    chrome.idle.queryState(settings.idleSeconds || 180),
  ]);
  const window = windows.find(
    (item) => item.focused && item.state !== "minimized",
  );
  const tab = window?.tabs?.find((item) => item.active);
  activeUrl = tab?.url || "";
  const targets: ActivityTarget[] = [];
  if (pausedUntil && pausedUntil <= now) {
    pausedUntil = null;
    await repository.saveSession({ pausedUntil });
  }
  status = !settings.isTrackingEnabled
    ? "disabled"
    : pausedUntil
      ? "manual"
      : idle === "locked"
        ? "locked"
        : idle === "idle"
          ? "idle"
          : !window
            ? "unfocused"
            : !hostnameFromUrl(activeUrl)
              ? "unsupported"
              : "tracking";

  for (const [id, gate] of gates) {
    if (id !== tab?.id || idle === "locked") {
      if (!gate.passed) {
        gate.elapsed = 0;
        gate.lastAt = 0;
      }
    }
  }
  if (settings.isTrackingEnabled && !pausedUntil && idle !== "locked") {
    const hostname = hostnameFromUrl(activeUrl);
    const hint = tab?.id !== undefined ? media.get(tab.id) : undefined;
    const foregroundMedia =
      !!settings.countMedia &&
      !!hint?.playing &&
      now - hint.at <= MAX_SAMPLE_GAP_MS;
    if (hostname && (idle === "active" || foregroundMedia)) {
      const policy = decision(activeUrl, now);
      const gate = tab?.id !== undefined ? gates.get(tab.id) : undefined;
      if (
        policy.reason !== "none" ||
        (policy.delaySeconds > 0 && !gate?.passed)
      )
        status = "blocked";
      else if (!policy.isException) {
        targets.push({ hostname, kind: "active" });
        status = foregroundMedia && idle !== "active" ? "media" : "tracking";
      } else status = "unsupported";
    }
    if (settings.countMedia) {
      for (const current of windows.flatMap((item) => item.tabs || [])) {
        if (
          current.id === undefined ||
          current.id === tab?.id ||
          current.mutedInfo?.muted
        )
          continue;
        const playing = media.get(current.id),
          host = hostnameFromUrl(current.url);
        if (
          !host ||
          !current.audible ||
          !playing?.playing ||
          now - playing.at > MAX_SAMPLE_GAP_MS
        )
          continue;
        const policy = decision(current.url!, now);
        if (
          policy.reason === "none" &&
          !policy.isException &&
          (!policy.delaySeconds || gates.get(current.id)?.passed)
        )
          targets.push({ hostname: host, kind: "media" });
      }
      if (targets.length && status !== "tracking") status = "media";
    }
  }
  const intervals = tracker.sample(now, targets, closePrevious);
  if (intervals.length) {
    await repository.appendIntervals(intervals);
    usage = await repository.getUsage();
  }
}

async function pageStatus(tabId: number): Promise<PolicyDecision> {
  const tab = await chrome.tabs.get(tabId),
    url = tab.url || "";
  const now = Date.now(),
    policy = decision(url, now);
  if (policy.reason !== "none" || !policy.delaySeconds || policy.isException)
    return policy;
  let gate = gates.get(tabId);
  if (!gate || gate.url !== url) {
    gate = { url, elapsed: 0, lastAt: 0, passed: false };
    gates.set(tabId, gate);
  }
  const window = await chrome.windows.get(tab.windowId);
  const idle = await chrome.idle.queryState(settings.idleSeconds || 180);
  if (
    window.focused &&
    tab.active &&
    window.state !== "minimized" &&
    idle === "active"
  ) {
    if (gate.lastAt && now - gate.lastAt <= MAX_SAMPLE_GAP_MS)
      gate.elapsed += now - gate.lastAt;
    else if (!gate.passed) gate.elapsed = 0;
    gate.lastAt = now;
    if (gate.elapsed >= policy.delaySeconds * 1000) gate.passed = true;
  } else if (!gate.passed) {
    gate.elapsed = 0;
    gate.lastAt = 0;
  }
  if (!gate.passed) {
    policy.reason = "entry_delay";
    policy.remainingMs = Math.max(0, policy.delaySeconds * 1000 - gate.elapsed);
    policy.canExtend = false;
  }
  return policy;
}

chrome.tabs.onActivated.addListener(() => {
  void enqueue(() => sample(true, true));
});
chrome.windows.onFocusChanged.addListener(() => {
  void enqueue(() => sample(true, true));
});
chrome.tabs.onUpdated.addListener((id, change) => {
  if (change.url) {
    gates.delete(id);
    media.delete(id);
    void enqueue(() => sample(true, true));
  }
});
chrome.tabs.onRemoved.addListener((id) => {
  gates.delete(id);
  media.delete(id);
  void enqueue(() => sample(true, true));
});
chrome.idle.onStateChanged.addListener(() => {
  void enqueue(() => sample(true));
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "heartbeat") void enqueue(() => sample(true));
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (
    (area === "sync" && changes[SETTINGS_KEY]) ||
    (area === "local" && (changes[USAGE_KEY] || changes[PIN_KEY]))
  ) {
    void enqueue(async () => {
      if (area === "sync") {
        settings = await repository.getSettings();
        chrome.idle.setDetectionInterval(settings.idleSeconds || 180);
        gates.clear();
        tracker.reset();
      }
      usage = await repository.getUsage();
      if (changes[PIN_KEY]) pinState = await repository.getPinState();
      if (area === "sync") await sample(true);
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const type = message?.type;
  const isPage = sender.tab?.id !== undefined;
  const isExtension =
    sender.id === chrome.runtime.id &&
    !!sender.url?.startsWith(chrome.runtime.getURL(""));
  if (!isPage && !isExtension) return false;
  const allowed = isExtension
    ? [
        "GET_CURRENT_SESSION",
        "PAUSE_TRACKING",
        "DELETE_RECORD",
        "EXTEND_TIME",
        "GET_PIN_STATUS",
        "CONFIGURE_PIN",
        "REMOVE_PIN",
      ]
    : ["PAGE_STATUS", "EXTEND_TIME", "OPEN_OPTIONS"];
  if (!allowed.includes(type)) return false;
  void enqueue(async () => {
    if (type === "GET_PIN_STATUS")
      return pinStatus(await repository.getPinState());
    if (type === "CONFIGURE_PIN" || type === "REMOVE_PIN") {
      try {
        return type === "REMOVE_PIN"
          ? await pins.remove(message.currentPin)
          : await pins.configure(
              message.currentPin,
              message.newPin,
              message.domains,
            );
      } finally {
        pinState = await repository.getPinState();
      }
    }
    if (type === "OPEN_OPTIONS") {
      await chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
      return { ok: true };
    }
    if (type === "PAGE_STATUS") {
      media.set(sender.tab!.id!, {
        playing: message.playing === true,
        at: Date.now(),
      });
      await sample();
      return {
        policy: await pageStatus(sender.tab!.id!),
        warningsEnabled: settings.warningsEnabled !== false,
      };
    }
    if (type === "GET_CURRENT_SESSION") {
      await sample();
      const tabs = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      const url = tabs[0]?.url || activeUrl;
      return {
        hostname: hostnameFromUrl(url),
        currentSessionMs: 0,
        status,
        pausedUntil,
        policy: decision(url),
      } satisfies CurrentSessionInfo;
    }
    if (type === "PAUSE_TRACKING") {
      const minutes =
        message.minutes === 0
          ? 0
          : [5, 15, 30, 60].includes(message.minutes)
            ? message.minutes
            : 15;
      pausedUntil = minutes ? Date.now() + minutes * 60_000 : null;
      tracker.reset();
      await repository.saveSession({ pausedUntil });
      await sample(true);
      return { ok: true };
    }
    if (type === "DELETE_RECORD") {
      if (typeof message.id !== "string") throw new Error("Invalid session");
      tracker.reset();
      await repository.mutateUsage((data) => {
        data.records = data.records.filter(
          (record) => record.id !== message.id,
        );
      });
      usage = await repository.getUsage();
      return { ok: true };
    }
    if (type === "EXTEND_TIME") {
      const tab =
        !isExtension && isPage
          ? await chrome.tabs.get(sender.tab!.id!)
          : (
              await chrome.tabs.query({ active: true, lastFocusedWindow: true })
            )[0];
      const url = tab?.url || "",
        policy = decision(url),
        hostname = hostnameFromUrl(url);
      if (!hostname || !policy.canExtend)
        throw new Error("A time extension is not available.");
      if (policy.pinRequired) {
        try {
          await pins.verify(message.pin);
        } finally {
          pinState = await repository.getPinState();
        }
      }
      const now = Date.now();
      await repository.mutateUsage((data) => {
        data.extensions.push({
          id: crypto.randomUUID(),
          hostname,
          day: dayKey(now),
          expiresAt: now + 5 * 60_000,
        });
      });
      usage = await repository.getUsage();
      return { ok: true };
    }
    return { ok: false };
  })
    .then(respond)
    .catch((error) =>
      respond({
        ...(error instanceof PinError
          ? { code: error.code, lockedUntil: error.lockedUntil }
          : {}),
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete this action.",
      }),
    );
  return true;
});
