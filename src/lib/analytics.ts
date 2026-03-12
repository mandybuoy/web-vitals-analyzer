// Thin Mixpanel wrapper — no-ops gracefully when token is missing

import mixpanel from "mixpanel-browser";

let initialized = false;

export function initAnalytics(): void {
  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  if (!token) return;

  mixpanel.init(token, {
    track_pageview: false, // we track manually
    persistence: "localStorage",
  });
  initialized = true;
}

export function track(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!initialized) return;
  mixpanel.track(event, properties);
}

export function identify(id: string): void {
  if (!initialized) return;
  mixpanel.identify(id);
}

export function setUserProperties(props: Record<string, unknown>): void {
  if (!initialized) return;
  mixpanel.people.set(props);
}
