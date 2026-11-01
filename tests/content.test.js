const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSync } = require("esbuild");
const { runInContext, createContext } = require("node:vm");
const { resolve } = require("node:path");

function event() {
  const listeners = new Set();
  return {
    listeners,
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
  };
}
function fixture(browser) {
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.isConnected = false;
      this.events = new Map();
      this.value = "";
    }
    setAttribute(name, value) {
      this[name] = value;
    }
    addEventListener(type, handler) {
      this.events.set(type, handler);
    }
    connect(value) {
      this.isConnected = value;
      this.children.forEach((child) => child.connect(value));
      this.shadow?.connect(value);
    }
    append(...nodes) {
      for (const node of nodes) {
        node.parent = this;
        this.children.push(node);
        node.connect(this.isConnected);
      }
    }
    attachShadow() {
      this.shadow = new Element("shadow");
      return this.shadow;
    }
    remove() {
      if (this.parent)
        this.parent.children = this.parent.children.filter(
          (child) => child !== this,
        );
      this.connect(false);
    }
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
    }
    focus() {}
  }
  const root = new Element("html");
  root.connect(true);
  const draft = new Element("input");
  draft.value = "unsaved draft";
  root.append(draft);
  const domEvents = new Map();
  const add = (type, callback) => {
    if (!domEvents.has(type)) domEvents.set(type, new Set());
    domEvents.get(type).add(callback);
  };
  const remove = (type, callback) => domEvents.get(type)?.delete(callback);
  const timers = new Map();
  let timerId = 0;
  const storageChanges = event(),
    runtimeMessages = event();
  let policy = {
    reason: "outside_hours",
    canExtend: false,
    pinRequired: false,
    remainingMs: 3_600_000,
    usedMs: 0,
    limitMs: 3_600_000,
    budgetName: "facebook.com",
    resetAt: new Date(2026, 9, 30, 18).getTime(),
    extensionUntil: null,
    isException: false,
    delaySeconds: 0,
  };
  const api = {
    runtime: {
      id: "extension",
      onMessage: runtimeMessages,
      sendMessage: async () => ({ policy, warningsEnabled: true }),
    },
    storage: {
      sync: { get: async () => ({ workaround_language: "en" }) },
      onChanged: storageChanges,
    },
  };
  const context = createContext({
    [browser]: api,
    HTMLElement: Element,
    document: {
      documentElement: root,
      activeElement: draft,
      visibilityState: "visible",
      createElement: (tag) => new Element(tag),
      querySelectorAll: (selector) =>
        selector === "#workaround-overlay"
          ? root.children.filter((node) => node.id === "workaround-overlay")
          : [],
      addEventListener: add,
      removeEventListener: remove,
    },
    window: { addEventListener: add, removeEventListener: remove },
    navigator: { language: "en" },
    history: { length: 1 },
    location: { href: "https://www.facebook.com/" },
    setInterval: (callback) => {
      const id = ++timerId;
      timers.set(id, callback);
      return id;
    },
    clearInterval: (id) => timers.delete(id),
    setTimeout: () => ++timerId,
    clearTimeout: () => {},
    console,
  });
  return {
    context,
    root,
    draft,
    timers,
    domEvents,
    storageChanges,
    runtimeMessages,
    changePolicy: (value) => {
      policy = { ...policy, ...value };
    },
  };
}
for (const browser of ["chrome", "browser"]) {
  test(`${browser}: an outside-hours block survives controller replacement and preserves page state`, async () => {
    const { outputFiles } = buildSync({
      entryPoints: [resolve("src/content/index.ts")],
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
      define: browser === "browser" ? { chrome: "browser" } : {},
    });
    const script = outputFiles[0].text;
    const f = fixture(browser);
    const flush = () => new Promise((resolve) => setImmediate(resolve));
    const overlays = () =>
      f.root.children.filter((node) => node.id === "workaround-overlay");
    // Model an invalidated older version that left a modal in the document.
    const legacy = f.context.document.createElement("div");
    legacy.id = "workaround-overlay";
    f.root.append(legacy);
    runInContext(script, f.context);
    await flush();
    assert.equal(overlays().length, 1);
    assert.equal(
      overlays()[0].shadow.children.find((node) => node.tag === "dialog").open,
      true,
    );
    assert.equal(f.draft.value, "unsaved draft");
    runInContext(script, f.context);
    await flush();
    assert.equal(overlays().length, 1, "recovery must replace the old overlay");
    assert.equal(f.timers.size, 2, "recovery must dispose old polling timers");
    assert.equal(f.storageChanges.listeners.size, 1);
    assert.equal(f.runtimeMessages.listeners.size, 1);
    for (const listeners of f.domEvents.values())
      assert.equal(listeners.size, 1);
    let reply;
    [...f.runtimeMessages.listeners][0](
      { type: "WORKAROUND_CONTENT_PING" },
      { id: "extension" },
      (value) => {
        reply = value;
      },
    );
    assert.equal(reply.ready, true);
    f.changePolicy({ reason: "none" });
    [...f.timers.values()][0]();
    await flush();
    assert.equal(
      overlays().length,
      0,
      "the block disappears when allowed hours begin",
    );
    assert.equal(f.draft.value, "unsaved draft");
  });
}
