/**
 * Detects search engine bots, Google Search Console Live Test / WRS, Lighthouse, and social/AI crawlers.
 * Used to avoid opening persistent streaming channels (Firestore Listen/channel) or waiting on
 * non-essential third-party trackers/fonts during indexing snapshots.
 */
export function isSearchCrawler(): boolean {
  if (typeof navigator === 'undefined') return true;
  const ua = navigator.userAgent || '';
  if (
    /bot|crawler|spider|crawling|googlebot|google-inspectiontool|googleother|google-read-aloud|duplexweb-google|adsbot-google|storebot-google|mediapartners-google|apis-google|feedfetcher-google|bingbot|slurp|duckduckbot|baiduspider|yandex|applebot|facebookexternalhit|facebot|meta-externalagent|whatsapp|twitterbot|linkedinbot|pinterest|gptbot|chatgpt-user|oai-searchbot|claudebot|anthropic-ai|perplexitybot|chrome-lighthouse|lighthouse|pagespeed|gtmetrix|headlesschrome|ptst/i.test(
      ua
    )
  ) {
    return true;
  }
  return Boolean((navigator as Navigator & { webdriver?: boolean }).webdriver);
}

/**
 * Wraps any Promise with a hard timeout so public data fetches resolve before crawler deadlines.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage = 'Operation timed out'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), ms);
    })
  ]);
}
