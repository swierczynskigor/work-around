export class CommandError extends Error {
  constructor(
    message: string,
    public code?: string,
    public lockedUntil?: number,
  ) {
    super(message);
  }
}
export function isExtension(): boolean {
  return (
    typeof chrome !== "undefined" && !!chrome.runtime?.id && !!chrome.storage
  );
}
export async function sendCommand<T>(
  type: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (!isExtension())
    throw new Error("Open this page from the installed WorkAround extension.");
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (response?.error)
    throw new CommandError(response.error, response.code, response.lockedUntil);
  return response as T;
}
