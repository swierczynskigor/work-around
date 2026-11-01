import { hostnameFromUrl } from "./policies";

const PING = "WORKAROUND_CONTENT_PING";
/** Restores the content controller after an extension reload without reloading websites. */
export class ContentScriptService {
  private pending = new Map<number, Promise<boolean>>();
  async ensure(
    tab: Pick<chrome.tabs.Tab, "id" | "url" | "discarded">,
  ): Promise<boolean | null> {
    if (tab.id === undefined || !hostnameFromUrl(tab.url) || tab.discarded)
      return null;
    const previous = this.pending.get(tab.id);
    if (previous) return previous;
    const operation = this.connect(tab.id);
    this.pending.set(tab.id, operation);
    try {
      return await operation;
    } finally {
      this.pending.delete(tab.id);
    }
  }
  private async responds(tabId: number): Promise<boolean> {
    try {
      const response = await chrome.tabs.sendMessage(
        tabId,
        { type: PING },
        { frameId: 0 },
      );
      return response?.ready === true;
    } catch {
      return false;
    }
  }
  private async connect(tabId: number): Promise<boolean> {
    if (await this.responds(tabId)) return true;
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
      return await this.responds(tabId);
    } catch {
      // Restricted pages, missing host permission or a tab that closed during recovery.
      return false;
    }
  }
  async restoreOpenTabs(): Promise<void> {
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(tabs.map((tab) => this.ensure(tab)));
  }
}
