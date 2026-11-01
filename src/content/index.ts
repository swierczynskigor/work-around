import { CommandError } from "../data/extensionClient";
import { focusSecurityCopy, pinErrorText } from "../lib/focus-security-i18n";
import { ChromeStorageRepository } from "../data/ChromeStorageRepository";
import { PolicyDecision } from "../domain/models";
import { experienceCopy } from "../lib/experience-i18n";
import { detectBrowserLanguage, Language } from "../lib/i18n";
import { formatDuration } from "../lib/utils";

let language: Language = detectBrowserLanguage();
let host: HTMLDivElement | null = null;
let dialog: HTMLDialogElement | null = null;
let detail: HTMLParagraphElement | null = null;
let errorLabel: HTMLParagraphElement | null = null;
let currentKey = "";
let checking = false;
let previousFocus: HTMLElement | null = null;
let notice: HTMLDivElement | null = null;
let noticeTimeout: ReturnType<typeof setTimeout> | undefined;
const warned = new Set<string>();

new ChromeStorageRepository()
  .getPreferences()
  .then((result) => {
    if (result.language) language = result.language;
  })
  .catch(() => undefined);
function onStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) {
  if (area === "sync" && changes.workaround_language) {
    language = changes.workaround_language.newValue as Language;
    currentKey = "";
  }
  if (area === "sync") void check();
}
chrome.storage.onChanged.addListener(onStorageChanged);
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
async function command<T>(
  type: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const response = await chrome.runtime.sendMessage({
    type,
    ...payload,
    playing: [...document.querySelectorAll("video,audio")].some((item) => {
      const media = item as HTMLMediaElement;
      return !media.paused && !media.ended && media.readyState >= 2;
    }),
  });
  if (response?.error)
    throw new CommandError(response.error, response.code, response.lockedUntil);
  return response;
}
function clearBlock() {
  if (!host) return;
  dialog?.close();
  host.remove();
  host = null;
  dialog = null;
  currentKey = "";
  detail = null;
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  previousFocus = null;
}
function button(text: string, action: () => void | Promise<void>) {
  const node = element("button", text);
  node.type = "button";
  node.addEventListener("click", () => {
    node.disabled = true;
    void Promise.resolve()
      .then(action)
      .catch((error) => {
        if (errorLabel)
          errorLabel.textContent =
            error instanceof Error
              ? error.message
              : experienceCopy(language).error;
      })
      .finally(() => {
        node.disabled = false;
      });
  });
  return node;
}
function showBlock(policy: PolicyDecision) {
  const copy = experienceCopy(language);
  const key = `${policy.reason}:${policy.canExtend}:${policy.pinRequired}:${language}`;
  if (key !== currentKey || !host?.isConnected) {
    clearBlock();
    currentKey = key;
    previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    host = element("div");
    host.id = "workaround-overlay";
    const shadow = host.attachShadow({ mode: "closed" });
    const style = element(
      "style",
      `:host { all: initial; color-scheme: dark; }
      dialog { box-sizing: border-box; max-width: 620px; width: calc(100vw - 40px); max-height: 90vh; overflow: auto; border: 1px solid #304663; border-radius: 24px; padding: 40px; background: #10151f; color: #eef6ff; font: 16px/1.6 system-ui; text-align: center; box-shadow: 0 20px 80px #10151f80; }
      dialog::backdrop { background: #10151fed; }
      h1 { font-size: 28px; line-height: 1.3; }
      span { color: #7dd3fc; font-weight: 600; }
      p { color: #adc0d9; white-space: pre-line; }
      p[role="alert"] { color: #fb8b9e; }
      button { background: #233650; color: #d9ebff; border: 1px solid #304663; border-radius: 10px; padding: 12px 18px; margin: 6px; font: inherit; cursor: pointer; transition: background .15s; }
      button:hover { background: #234561; }
      button.primary { background: #7dd3fc; color: #10151f; border-color: #7dd3fc; }
      button.primary:hover { background: #bae6fd; }
      button:focus-visible { outline: 3px solid #7dd3fc; outline-offset: 3px; }
      button:disabled, input:disabled { opacity: .5; }
      label { display: block; color: #d9ebff; margin: 12px 0 6px; }
      input { display: block; box-sizing: border-box; width: 220px; max-width: 100%; margin: 0 auto 10px; background: #172235; border: 1px solid #506b8e; border-radius: 8px; color: #eef6ff; padding: 10px 12px; font: inherit; text-align: center; }
      input:focus { outline: 2px solid #7dd3fc; outline-offset: 2px; }`,
    );
    dialog = element("dialog");
    dialog.setAttribute("aria-labelledby", "workaround-title");
    dialog.addEventListener("cancel", (event) => event.preventDefault());
    const title = element(
      "h1",
      policy.reason === "none" ? "" : copy[policy.reason],
    );
    title.id = "workaround-title";
    const message = element(
      "p",
      policy.reason === "entry_delay" ? copy.delayMessage : copy.blockMessage,
    );
    detail = element("p");
    detail.setAttribute("aria-live", "off");
    errorLabel = element("p");
    errorLabel.setAttribute("role", "alert");
    dialog.append(element("span", "WorkAround"), title, message, detail);
    if (policy.canExtend) {
      const form = element("form");
      const pin = element("input");
      if (policy.pinRequired) {
        const label = element("label", focusSecurityCopy(language).pinRequired);
        pin.id = "workaround-pin";
        label.htmlFor = pin.id;
        pin.type = "password";
        pin.inputMode = "numeric";
        pin.autocomplete = "off";
        pin.maxLength = 8;
        pin.pattern = "[0-9]{4,8}";
        pin.required = true;
        form.append(label, pin);
      }
      const extend = element("button", copy.extra);
      extend.type = "submit";
      extend.className = "primary";
      form.append(extend);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (extend.disabled) return;
        const value = pin.value;
        pin.value = "";
        pin.disabled = true;
        extend.disabled = true;
        if (errorLabel) errorLabel.textContent = "";
        void command("EXTEND_TIME", { pin: value })
          .then(() => check())
          .catch((error) => {
            if (errorLabel)
              errorLabel.textContent = pinErrorText(error, language);
          })
          .finally(() => {
            pin.disabled = false;
            extend.disabled = false;
          });
      });
      dialog.append(form);
    }
    if (policy.reason === "youtube_shorts")
      dialog.append(
        button(copy.returnYouTube, () => {
          location.href = "https://www.youtube.com/";
        }),
      );
    dialog.append(
      button(copy.settings, async () => {
        await command("OPEN_OPTIONS");
      }),
    );
    if (history.length > 1)
      dialog.append(button(copy.back, () => history.back()));
    dialog.append(errorLabel);
    shadow.append(style, dialog);
    document.documentElement.append(host);
    dialog.showModal();
    // Pause media without replacing the page or losing forms, scroll position or app state.
    for (const item of document.querySelectorAll("video,audio"))
      (item as HTMLMediaElement).pause();
  }
  if (detail) {
    if (policy.reason === "entry_delay")
      detail.textContent = `${Math.ceil((policy.remainingMs || 0) / 1000)} ${copy.delay}`;
    else
      detail.textContent = [
        policy.budgetName ? `${copy.budget}: ${policy.budgetName}` : "",
        policy.limitMs !== null
          ? `${copy.used}: ${formatDuration(policy.usedMs)} / ${formatDuration(policy.limitMs)}`
          : "",
        policy.resetAt && policy.reason === "time_limit"
          ? `${copy.reset}: ${new Date(policy.resetAt).toLocaleString(language)}`
          : "",
        policy.resetAt &&
        ["outside_hours", "focus_mode"].includes(policy.reason)
          ? `${copy.available}: ${new Date(policy.resetAt).toLocaleString(language)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
  }
}
function warn(policy: PolicyDecision, enabled: boolean) {
  if (
    !enabled ||
    document.visibilityState !== "visible" ||
    policy.remainingMs === null ||
    policy.remainingMs <= 0 ||
    policy.remainingMs > 300_000
  )
    return;
  const threshold = policy.remainingMs <= 60_000 ? 60 : 300;
  const key = `${location.href}:${policy.budgetName}:${policy.resetAt}:${policy.extensionUntil}:${threshold}`;
  if (warned.has(key)) return;
  warned.add(key);
  if (threshold === 60) warned.add(key.replace(/:60$/, ":300"));
  notice?.remove();
  if (noticeTimeout) clearTimeout(noticeTimeout);
  notice = element("div");
  const shadow = notice.attachShadow({ mode: "closed" });
  shadow.append(
    element(
      "style",
      `:host { all: initial; color-scheme: dark; position: fixed; bottom: 24px; right: 24px; z-index: 2147483647; }
      div { background: #172235; color: #eef6ff; padding: 16px 20px; border: 1px solid #7dd3fc; border-radius: 14px; box-shadow: 0 8px 32px #10151f66; font: 15px/1.5 system-ui; }
      button { margin-left: 16px; color: #7dd3fc; background: transparent; border: 1px solid #506b8e; border-radius: 6px; padding: 4px 8px; cursor: pointer; }
      button:hover { background: #234561; }
      button:focus-visible { outline: 2px solid #7dd3fc; outline-offset: 3px; }`,
    ),
  );
  const box = element(
    "div",
    `WorkAround · ${experienceCopy(language).warning}: ${formatDuration(policy.remainingMs)}`,
  );
  box.setAttribute("role", "status");
  box.append(button(experienceCopy(language).dismiss, () => notice?.remove()));
  shadow.append(box);
  document.documentElement.append(notice);
  noticeTimeout = setTimeout(() => notice?.remove(), 12_000);
}
async function check() {
  if (checking || !chrome.runtime?.id) return;
  checking = true;
  try {
    const { policy, warningsEnabled } = await command<{
      policy: PolicyDecision;
      warningsEnabled: boolean;
    }>("PAGE_STATUS");
    if (policy.reason !== "none") {
      notice?.remove();
      showBlock(policy);
    } else {
      clearBlock();
      warn(policy, warningsEnabled);
    }
  } catch {
    // A reloaded extension invalidates old content scripts; do not destroy the page.
  } finally {
    checking = false;
  }
}
function onVisibilityChange() {
  void check();
}
function onPlay() {
  if (dialog?.open)
    for (const item of document.querySelectorAll("video,audio"))
      (item as HTMLMediaElement).pause();
  void check();
}
function onPause() {
  void check();
}
function onNavigation() {
  void check();
}
setInterval(() => {
  if (document.visibilityState === "visible") void check();
}, 1000);
setInterval(() => {
  if (document.visibilityState !== "visible") void check();
}, 5000);
document.addEventListener("visibilitychange", onVisibilityChange);
document.addEventListener("play", onPlay, true);
document.addEventListener("pause", onPause, true);
window.addEventListener("popstate", onNavigation);
void check();
