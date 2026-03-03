// Known third-party domain -> category lookup
// Used to classify third-party scripts detected in HTML

export const THIRD_PARTY_DB: Record<string, string> = {
  // Tag Managers
  "www.googletagmanager.com": "tag_manager",
  "tagmanager.google.com": "tag_manager",

  // Analytics
  "www.google-analytics.com": "analytics",
  "analytics.google.com": "analytics",
  "www.googletagservices.com": "analytics",
  "cdn.segment.com": "analytics",
  "cdn.amplitude.com": "analytics",
  "cdn.mxpnl.com": "analytics",
  "static.hotjar.com": "analytics",
  "script.hotjar.com": "analytics",
  "snap.licdn.com": "analytics",
  "connect.facebook.net": "analytics",
  "bat.bing.com": "analytics",
  "www.clarity.ms": "analytics",
  "js.hs-analytics.net": "analytics",
  "plausible.io": "analytics",
  "cdn.heapanalytics.com": "analytics",
  "js.hs-scripts.com": "analytics",

  // A/B Testing
  "dev.visualwebsiteoptimizer.com": "ab_testing",
  "cdn.optimizely.com": "ab_testing",
  "js.launchdarkly.com": "ab_testing",
  "cdn-3.convertexperiments.com": "ab_testing",

  // Advertising
  "pagead2.googlesyndication.com": "advertising",
  "securepubads.g.doubleclick.net": "advertising",
  "ads.google.com": "advertising",
  "www.googleadservices.com": "advertising",
  "static.ads-twitter.com": "advertising",
  "ad.doubleclick.net": "advertising",

  // CDN
  "cdnjs.cloudflare.com": "cdn",
  "cdn.jsdelivr.net": "cdn",
  "unpkg.com": "cdn",
  "ajax.googleapis.com": "cdn",
  "code.jquery.com": "cdn",
  "stackpath.bootstrapcdn.com": "cdn",

  // Social
  "platform.twitter.com": "social",
  "platform.instagram.com": "social",
  "apis.google.com": "social",
  "www.youtube.com": "social",

  // Chat / Support
  "widget.intercom.io": "chat",
  "js.intercomcdn.com": "chat",
  "embed.tawk.to": "chat",
  "static.zdassets.com": "chat",
  "widget.drift.com": "chat",
  "js.driftt.com": "chat",
  "cdn.livechatinc.com": "chat",

  // Maps
  "maps.googleapis.com": "maps",
  "maps.google.com": "maps",
  "api.mapbox.com": "maps",

  // Consent Management
  "cdn.cookielaw.org": "consent",
  "consent.cookiebot.com": "consent",
  "cdn.iubenda.com": "consent",

  // Fonts
  "fonts.googleapis.com": "fonts",
  "fonts.gstatic.com": "fonts",
  "use.typekit.net": "fonts",

  // Payments
  "js.stripe.com": "payments",
  "www.paypal.com": "payments",

  // Performance Monitoring
  "rum.hlx.page": "monitoring",
  "cdn.speedcurve.com": "monitoring",
  "js.sentry-cdn.com": "monitoring",
  "browser.sentry-cdn.com": "monitoring",
};

export function classifyDomain(hostname: string): string {
  return THIRD_PARTY_DB[hostname] || "unknown";
}
