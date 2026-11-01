import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../src/services/policies";
import { CurrentSessionInfo } from "../src/domain/models";
import {
  USAGE_KEY,
  SETTINGS_KEY,
} from "../src/data/ChromeStorageRepository";

const firefox = process.env.WORKAROUND_TEST_BROWSER === "firefox";
const protocol = firefox ? "moz-extension" : "chrome-extension";

test(`${firefox ? "Firefox" : "Chrome"} background integration: sleep, idle, lock, pause, media, corrections, delay and extensions`, async () => {
  const originalNow = Date.now;
  let now = originalNow(),
    idle = "active",
    focused = true;
  Date.now = () => now;
  const event = () => {
    const listeners: ((...args: unknown[]) => unknown)[] = [];
    return {
      addListener: (listener: (...args: unknown[]) => unknown) =>
        listeners.push(listener),
      emit: (...args: unknown[]) =>
        listeners.forEach((listener) => listener(...args)),
    };
  };
  const changed = event(),
    messages = event(),
    activated = event(),
    updated = event(),
    focus = event(),
    idleChanged = event();
  const local: Record<string, unknown> = {},
    sync: Record<string, unknown> = {
      [SETTINGS_KEY]: structuredClone(DEFAULT_SETTINGS),
    },
    session: Record<string, unknown> = {};
  const area = (data: Record<string, unknown>, name: string) => ({
    get: async (keys: string | string[]) =>
      structuredClone(
        Object.fromEntries(
          (Array.isArray(keys) ? keys : [keys]).map((key) => [key, data[key]]),
        ),
      ),
    set: async (value: Record<string, unknown>) => {
      Object.assign(data, structuredClone(value));
      changed.emit(
        Object.fromEntries(
          Object.keys(value).map((key) => [key, { newValue: value[key] }]),
        ),
        name,
      );
    },
  });
  const tabs = [
    {
      id: 1,
      windowId: 1,
      active: true,
      audible: false,
      url: "https://example.com/",
    },
    {
      id: 2,
      windowId: 1,
      active: false,
      audible: true,
      url: "https://example.com/media",
    },
  ];
  const sender = (id: number) => ({
    id: "extension",
    tab: tabs.find((tab) => tab.id === id),
    url: tabs.find((tab) => tab.id === id)?.url,
  });
  const ui = {
    id: "extension",
    url: `${protocol}://extension/popup.html`,
  };
  let listener!: (
    message: unknown,
    sender: unknown,
    respond: (value: unknown) => void,
  ) => void;
  Object.assign(globalThis, {
    [firefox ? "browser" : "chrome"]: {
      storage: {
        local: area(local, "local"),
        sync: area(sync, "sync"),
        session: area(session, "session"),
        onChanged: changed,
      },
      runtime: {
        id: "extension",
        getURL: (path: string) => `${protocol}://extension/${path}`,
        onMessage: {
          addListener: (fn: typeof listener) => {
            listener = fn;
          },
        },
      },
      tabs: {
        get: async (id: number) => tabs.find((tab) => tab.id === id),
        query: async (query: { active?: boolean }) =>
          query.active ? tabs.filter((tab) => tab.active) : tabs,
        onActivated: activated,
        onUpdated: updated,
        onRemoved: event(),
        create: async () => ({}),
      },
      windows: {
        getAll: async () => [{ id: 1, focused, state: "normal", tabs }],
        get: async () => ({ focused, state: "normal" }),
        onFocusChanged: focus,
      },
      idle: {
        queryState: async () => idle,
        setDetectionInterval: () => undefined,
        onStateChanged: idleChanged,
      },
      alarms: {
        get: async () => true,
        create: async () => undefined,
        onAlarm: messages,
      },
    },
  });
  const send = <T>(
    type: string,
    payload = {},
    from: unknown = ui,
  ): Promise<T> =>
    new Promise((resolve) =>
      listener({ type, ...payload }, from, (value) => resolve(value as T)),
    );
  const pulse = (id = 1, playing = false) =>
    send("PAGE_STATUS", { playing }, sender(id));
  const flush = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    return send<CurrentSessionInfo>("GET_CURRENT_SESSION");
  };
  const total = () =>
    (
      (local[USAGE_KEY] as { records: { durationMs: number }[] })?.records || []
    ).reduce((sum, record) => sum + record.durationMs, 0);
  const settings = async (patch: object) => {
    await chrome.storage.sync.set({
      [SETTINGS_KEY]: { ...(sync[SETTINGS_KEY] as object), ...patch },
    });
    await flush();
  };
  try {
    await import("../src/background/index");
    await pulse();
    now += 5000;
    await pulse();
    assert.equal(total(), 5000);
    now += 3600000;
    await pulse();
    assert.equal(total(), 5000, "sleep must not consume a budget");
    now += 5000;
    await pulse();
    assert.equal(total(), 10000);
    idle = "locked";
    idleChanged.emit("locked");
    await flush();
    now += 5000;
    await pulse();
    assert.equal(total(), 10000);
    idle = "idle";
    idleChanged.emit("idle");
    await flush();
    now += 5000;
    await pulse();
    assert.equal(total(), 10000);
    idle = "active";
    idleChanged.emit("active");
    await flush();
    await send("PAUSE_TRACKING", { minutes: 15 });
    now += 5000;
    await pulse();
    assert.equal(total(), 10000);
    await send("PAUSE_TRACKING", { minutes: 0 });
    now += 5000;
    await pulse();
    assert.equal(total(), 15000);
    await settings({ isTrackingEnabled: false });
    now += 5000;
    await pulse();
    assert.equal(total(), 15000);
    await settings({ isTrackingEnabled: true, countMedia: true });
    await pulse(2, true);
    now += 5000;
    await pulse(2, true);
    assert.equal(
      total(),
      20000,
      "parallel tabs on the same domain must not double count",
    );
    focused = false;
    focus.emit(-1);
    await flush();
    now += 5000;
    await pulse(2, true);
    assert.equal(total(), 25000, "opt-in media can count in background");
    idle = "locked";
    idleChanged.emit("locked");
    await flush();
    now += 5000;
    await pulse(2, true);
    assert.equal(total(), 25000);
    idle = "active";
    focused = true;
    idleChanged.emit("active");
    await flush();
    await settings({
      limits: [{ hostname: "example.com", dailyLimitMs: 1000 }],
      countMedia: false,
    });
    let response = (await pulse()) as {
      policy: { reason: string; canExtend: boolean };
    };
    assert.equal(response.policy.reason, "time_limit");
    assert.equal(response.policy.canExtend, true);
    await send("EXTEND_TIME", {}, sender(1));
    response = (await pulse()) as typeof response;
    assert.equal(response.policy.reason, "none");
    now += 300000;
    response = (await pulse()) as typeof response;
    assert.equal(response.policy.reason, "time_limit");
    assert.equal(response.policy.canExtend, false);
    const records = (local[USAGE_KEY] as { records: { id: string }[] }).records;
    for (const record of records)
      await send("DELETE_RECORD", { id: record.id });
    assert.equal(total(), 0);
    await settings({
      limits: [{ hostname: "example.com", dailyLimitMs: 600000 }],
      entryDelaySeconds: 10,
    });
    response = (await pulse()) as typeof response;
    assert.equal(response.policy.reason, "entry_delay");
    now += 5000;
    await pulse();
    focused = false;
    focus.emit(-1);
    await flush();
    now += 5000;
    await pulse();
    focused = true;
    focus.emit(1);
    await flush();
    response = (await pulse()) as typeof response;
    assert.equal(response.policy.reason, "entry_delay");
    now += 5000;
    await pulse();
    now += 5000;
    response = (await pulse()) as typeof response;
    assert.equal(response.policy.reason, "none");

    await settings({ entryDelaySeconds: 0 });
    tabs[0].url = "https://www.facebook.com/";
    now = new Date(2026, 9, 30, 8).getTime();
    await settings({
      limits: [
        {
          hostname: "facebook.com",
          dailyLimitMs: 3_600_000,
          allowedTimeWindows: [
            { startHour: 18, startMinute: 0, endHour: 23, endMinute: 0 },
          ],
        },
      ],
    });
    await send("PAUSE_TRACKING", { minutes: 15 });
    const morning = (await pulse()) as {
      policy: { reason: string; canExtend: boolean };
    };
    assert.equal(
      morning.policy.reason,
      "outside_hours",
      "Facebook is blocked at 08:00 even while tracking is paused",
    );
    assert.equal(morning.policy.canExtend, false);
    now = new Date(2026, 9, 30, 18).getTime();
    assert.equal(((await pulse()) as typeof morning).policy.reason, "none");
    now = new Date(2026, 9, 30, 23).getTime();
    assert.equal(
      ((await pulse()) as typeof morning).policy.reason,
      "outside_hours",
    );
  } finally {
    Date.now = originalNow;
  }
});
