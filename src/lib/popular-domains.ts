/**
 * List of popular domains for autocomplete suggestions.
 * Focused on social media, entertainment, and common distraction sites.
 */
export const POPULAR_DOMAINS = [
  // Social Media
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "tiktok.com",
  "snapchat.com",
  "pinterest.com",
  "reddit.com",
  "tumblr.com",
  "discord.com",
  "threads.net",
  "mastodon.social",
  
  // Video & Streaming
  "youtube.com",
  "netflix.com",
  "twitch.tv",
  "hulu.com",
  "disneyplus.com",
  "hbomax.com",
  "primevideo.com",
  "vimeo.com",
  "dailymotion.com",
  
  // News & Media
  "cnn.com",
  "bbc.com",
  "nytimes.com",
  "theguardian.com",
  "washingtonpost.com",
  "huffpost.com",
  "buzzfeed.com",
  "vice.com",
  
  // Shopping
  "amazon.com",
  "ebay.com",
  "aliexpress.com",
  "etsy.com",
  "wish.com",
  "shein.com",
  
  // Gaming
  "steam.com",
  "epicgames.com",
  "roblox.com",
  "minecraft.net",
  "ign.com",
  "kotaku.com",
  
  // Tech & Forums
  "hackernews.com",
  "news.ycombinator.com",
  "stackoverflow.com",
  "quora.com",
  "medium.com",
  "substack.com",
  
  // Other
  "spotify.com",
  "soundcloud.com",
  "wikipedia.org",
  "imdb.com",
  "rottentomatoes.com",
  "9gag.com",
  "imgur.com",
  "giphy.com",
] as const;

export type PopularDomain = typeof POPULAR_DOMAINS[number];

/**
 * Filter domains by search query.
 * @param query - User input to filter by
 * @param limit - Maximum number of results
 * @returns Filtered list of domains
 */
export function filterDomains(query: string, limit: number = 10): string[] {
  if (!query || query.length < 2) return [];
  
  const lowerQuery = query.toLowerCase();
  return POPULAR_DOMAINS
    .filter(domain => domain.toLowerCase().includes(lowerQuery))
    .slice(0, limit);
}
