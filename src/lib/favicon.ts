/**
 * Get favicon URL for a given domain using Google's Favicon API.
 * This doesn't require downloading or storing favicons locally.
 * 
 * @param hostname - The domain name (e.g., "facebook.com")
 * @param size - Icon size in pixels (default: 32)
 * @returns URL to the favicon image
 */
export function getFaviconUrl(hostname: string, size: number = 32): string {
  // Clean up hostname - remove www. prefix for consistency
  const cleanHostname = hostname.replace(/^www\./, '');
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanHostname)}&sz=${size}`;
}

/**
 * Get a higher quality favicon URL using DuckDuckGo's API.
 * Falls back to Google if needed.
 * 
 * @param hostname - The domain name
 * @returns URL to the favicon image
 */
export function getFaviconUrlHQ(hostname: string): string {
  const cleanHostname = hostname.replace(/^www\./, '');
  return `https://icons.duckduckgo.com/ip3/${cleanHostname}.ico`;
}
