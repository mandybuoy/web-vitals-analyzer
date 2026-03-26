// Google PageSpeed Insights API client

// Types are defined in types.ts — re-export for backward compatibility
export type {
  PSIResult,
  FieldData,
  FieldMetric,
  MetricData,
  DiagnosticItem,
  OpportunityItem,
  ResourceItem,
  NetworkRequestItem,
} from "./types";

import type {
  PSIResult,
  FieldMetric,
  MetricData,
  FieldData,
  DiagnosticItem,
  OpportunityItem,
  ResourceItem,
  NetworkRequestItem,
  ScriptTreemapModule,
} from "./types";

// Thresholds for Core Web Vitals
const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  inp: { good: 200, poor: 500 },
  cls: { good: 0.1, poor: 0.25 },
  fcp: { good: 1800, poor: 3000 },
  tbt: { good: 200, poor: 600 },
  si: { good: 3400, poor: 5800 },
  ttfb: { good: 800, poor: 1800 },
};

function getRating(
  metric: string,
  value: number,
): "good" | "needs-improvement" | "poor" {
  const threshold = THRESHOLDS[metric as keyof typeof THRESHOLDS];
  if (!threshold) return "needs-improvement";
  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

function extractMetric(
  audits: any,
  auditId: string,
  shortName: string,
  name: string,
  metricKey: string,
  description: string,
): MetricData {
  const audit = audits[auditId];
  if (!audit) {
    return {
      name,
      shortName,
      value: 0,
      displayValue: "N/A",
      score: 0,
      rating: "poor",
      description,
    };
  }

  const value = audit.numericValue || 0;
  const score = audit.score ?? 0;

  return {
    name,
    shortName,
    value,
    displayValue: audit.displayValue || `${Math.round(value)} ms`,
    score,
    rating: getRating(metricKey, value),
    description,
  };
}

// Transient PSI errors worth retrying (NO_FCP, rate limits, server errors)
const RETRYABLE_PATTERNS = [
  /NO_FCP/,
  /NO_LCP/,
  /FAILED_DOCUMENT_REQUEST/,
  /ERRORED_DOCUMENT_REQUEST/,
];
const PSI_MAX_RETRIES = 1; // 2 total attempts per device (down from 3)
const PSI_BASE_BACKOFF_MS = 3_000;
const PSI_TIMEOUT_MS = 90_000; // 90s — Google typically responds within 30-60s

// ----- Items[] extraction helpers -----

const MAX_ITEMS_PER_AUDIT = 15;
const MAX_ITEMS_CHARS = 2_000;
const MAX_NETWORK_REQUESTS = 30;

/** Strip query params and fragments from URLs to save tokens */
function stripUrlParams(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

/** Sort key varies by audit type */
const SORT_KEY_BY_AUDIT: Record<string, keyof ResourceItem> = {
  "bootup-time": "wastedMs",
  "mainthread-work-breakdown": "totalBytes",
  "third-party-summary": "totalBytes",
  "long-tasks": "wastedMs",
};

/**
 * Extract and truncate items[] from a PSI audit.
 * Keeps the highest-impact items, strips URL query params, and enforces a character budget.
 */
function truncateItems(
  audit: any,
  maxItems = MAX_ITEMS_PER_AUDIT,
): ResourceItem[] | undefined {
  const rawItems = audit?.details?.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) return undefined;

  const sortKey = SORT_KEY_BY_AUDIT[audit.id] ?? "wastedBytes";

  const mapped: ResourceItem[] = rawItems
    .map((item: any) => {
      const ri: ResourceItem = {};
      if (item.url) ri.url = stripUrlParams(item.url);
      if (item.totalBytes != null) ri.totalBytes = Math.round(item.totalBytes);
      if (item.transferSize != null)
        ri.transferSize = Math.round(item.transferSize);
      if (item.wastedBytes != null)
        ri.wastedBytes = Math.round(item.wastedBytes);
      if (item.wastedMs != null) ri.wastedMs = Math.round(item.wastedMs);
      // bootup-time uses 'total' for CPU time (not wastedMs)
      if (item.total != null && ri.wastedMs == null)
        ri.wastedMs = Math.round(item.total);
      if (item.label) ri.label = item.label;
      // Also capture groupLabel (used by mainthread-work-breakdown)
      if (item.groupLabel) ri.label = item.groupLabel;
      return ri;
    })
    .filter(
      (ri: ResourceItem) =>
        ri.url || ri.label || ri.totalBytes || ri.wastedBytes,
    );

  // Sort by the audit-appropriate key, descending
  mapped.sort((a: ResourceItem, b: ResourceItem) => {
    const aVal = (a[sortKey] as number) ?? 0;
    const bVal = (b[sortKey] as number) ?? 0;
    return bVal - aVal;
  });

  // Enforce item count limit, then character budget
  let items = mapped.slice(0, maxItems);
  let serialized = JSON.stringify(items);
  while (serialized.length > MAX_ITEMS_CHARS && items.length > 3) {
    items = items.slice(0, items.length - 1);
    serialized = JSON.stringify(items);
  }

  return items.length > 0 ? items : undefined;
}

/** Extract top network requests sorted by transferSize */
function extractNetworkRequests(audits: any): NetworkRequestItem[] | undefined {
  const audit = audits["network-requests"];
  const rawItems = audit?.details?.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) return undefined;

  const mapped: NetworkRequestItem[] = rawItems
    .filter((item: any) => item.url && item.transferSize != null)
    .map((item: any) => ({
      url: stripUrlParams(item.url),
      resourceType: item.resourceType || "Other",
      transferSize: Math.round(item.transferSize),
      startTime: Math.round(item.startTime || 0),
      endTime: Math.round(item.endTime || 0),
    }));

  mapped.sort((a, b) => b.transferSize - a.transferSize);

  return mapped.slice(0, MAX_NETWORK_REQUESTS);
}

/** Extract script treemap data (module-level JS breakdown) */
function extractScriptTreemap(
  audits: Record<string, any>,
): ScriptTreemapModule[] | undefined {
  const audit = audits["script-treemap-data"];
  const nodes = audit?.details?.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return undefined;

  const modules: ScriptTreemapModule[] = nodes
    .filter((node: any) => node.name && typeof node.resourceBytes === "number")
    .map((node: any) => ({
      name: node.name,
      resourceBytes: Math.round(node.resourceBytes),
      unusedBytes:
        node.unusedBytes != null ? Math.round(node.unusedBytes) : undefined,
    }))
    .sort(
      (a: ScriptTreemapModule, b: ScriptTreemapModule) =>
        b.resourceBytes - a.resourceBytes,
    )
    .slice(0, 15);

  return modules.length > 0 ? modules : undefined;
}

export interface PSIFetchOptions {
  onRetry?: (attempt: number, maxRetries: number, reason: string) => void;
  signal?: AbortSignal; // Pipeline-level abort signal
}

export async function fetchPSI(
  url: string,
  strategy: "mobile" | "desktop",
  apiKey: string,
  options?: PSIFetchOptions,
): Promise<PSIResult> {
  const apiUrl = new URL(
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
  );
  apiUrl.searchParams.set("url", url);
  apiUrl.searchParams.set("key", apiKey);
  apiUrl.searchParams.set("strategy", strategy);
  apiUrl.searchParams.set("category", "performance");

  let lastError: Error | null = null;

  // Combine pipeline abort signal with per-request timeout
  const buildSignal = () => {
    const signals: AbortSignal[] = [AbortSignal.timeout(PSI_TIMEOUT_MS)];
    if (options?.signal) signals.push(options.signal);
    return AbortSignal.any(signals);
  };

  for (let attempt = 0; attempt <= PSI_MAX_RETRIES; attempt++) {
    // Check if pipeline was aborted before retrying
    if (options?.signal?.aborted) {
      throw new Error("Pipeline aborted");
    }

    if (attempt > 0) {
      const backoffMs = PSI_BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      const reason = lastError?.message ?? "unknown error";
      console.log(
        `[psi] Retry ${attempt}/${PSI_MAX_RETRIES} for ${strategy} after ${backoffMs / 1000}s...`,
      );
      options?.onRetry?.(attempt, PSI_MAX_RETRIES, reason);
      // Interruptible backoff delay
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, backoffMs);
        if (options?.signal) {
          options.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(new Error("Pipeline aborted during backoff"));
            },
            { once: true },
          );
        }
      });
    }

    let response: Response;
    try {
      response = await fetch(apiUrl.toString(), {
        signal: buildSignal(),
      });
    } catch (err) {
      // Retry on timeout or network errors (but not pipeline abort)
      if (
        options?.signal?.aborted ||
        (err instanceof Error && err.message.includes("Pipeline aborted"))
      ) {
        throw err;
      }
      if (attempt < PSI_MAX_RETRIES) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `[psi] ${strategy} fetch failed (attempt ${attempt + 1}): ${lastError.message}`,
        );
        continue;
      }
      throw err;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error.error?.message || response.statusText;

      // Retry on transient errors (429 rate limit, 5xx server errors, known Lighthouse failures)
      const isRetryable =
        response.status === 429 ||
        response.status >= 500 ||
        RETRYABLE_PATTERNS.some((p) => p.test(message));

      if (isRetryable && attempt < PSI_MAX_RETRIES) {
        lastError = new Error(`PSI API error (${response.status}): ${message}`);
        continue;
      }

      throw new Error(`PSI API error (${response.status}): ${message}`);
    }

    // Success — break out of retry loop
    lastError = null;

    const data = await response.json();
    const lighthouse = data.lighthouseResult;
    const audits = lighthouse?.audits || {};

    // Extract field data (CrUX - real user data)
    const loadingExperience = data.loadingExperience;
    let fieldData: FieldData | undefined;

    if (loadingExperience && loadingExperience.metrics) {
      const extractFieldMetric = (metricData: any): FieldMetric | undefined => {
        if (!metricData) return undefined;
        return {
          percentile: metricData.percentile || 0,
          category: metricData.category || "AVERAGE",
          distributions: metricData.distributions || [],
        };
      };

      fieldData = {
        lcp: extractFieldMetric(
          loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS,
        ),
        inp: extractFieldMetric(
          loadingExperience.metrics.INTERACTION_TO_NEXT_PAINT,
        ),
        cls: extractFieldMetric(
          loadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE,
        ),
        fcp: extractFieldMetric(
          loadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS,
        ),
        fid: extractFieldMetric(loadingExperience.metrics.FIRST_INPUT_DELAY_MS),
        ttfb: extractFieldMetric(
          loadingExperience.metrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE,
        ),
      };
    }

    // Extract metrics
    const metrics = {
      lcp: extractMetric(
        audits,
        "largest-contentful-paint",
        "LCP",
        "Largest Contentful Paint",
        "lcp",
        "Time until the largest content element is visible",
      ),
      inp: extractMetric(
        audits,
        "interaction-to-next-paint",
        "INP",
        "Interaction to Next Paint",
        "inp",
        "Responsiveness to user interactions",
      ),
      cls: {
        ...extractMetric(
          audits,
          "cumulative-layout-shift",
          "CLS",
          "Cumulative Layout Shift",
          "cls",
          "Visual stability — how much the layout shifts during loading",
        ),
        displayValue:
          audits["cumulative-layout-shift"]?.displayValue ||
          (audits["cumulative-layout-shift"]?.numericValue?.toFixed(3) ??
            "N/A"),
      },
      fcp: extractMetric(
        audits,
        "first-contentful-paint",
        "FCP",
        "First Contentful Paint",
        "fcp",
        "Time until the first content is painted on screen",
      ),
      tbt: extractMetric(
        audits,
        "total-blocking-time",
        "TBT",
        "Total Blocking Time",
        "tbt",
        "Total time the main thread was blocked",
      ),
      si: extractMetric(
        audits,
        "speed-index",
        "SI",
        "Speed Index",
        "si",
        "How quickly content is visually displayed during load",
      ),
      ttfb: extractMetric(
        audits,
        "server-response-time",
        "TTFB",
        "Time to First Byte",
        "ttfb",
        "Server response time for the main document",
      ),
    };

    // Extract diagnostics
    const diagnosticIds = [
      "dom-size",
      "mainthread-work-breakdown",
      "bootup-time",
      "font-display",
      "third-party-summary",
      "long-tasks",
      "layout-shifts",
      "non-composited-animations",
      "unsized-images",
      "viewport",
    ];

    const diagnostics: DiagnosticItem[] = diagnosticIds
      .map((id) => audits[id])
      .filter(Boolean)
      .filter((audit) => audit.score !== null && audit.score < 1)
      .map((audit) => {
        const items = truncateItems(audit);
        const totalCount = audit.details?.items?.length ?? 0;
        const displaySuffix =
          items && totalCount > items.length
            ? ` (showing top ${items.length} of ${totalCount})`
            : "";
        return {
          id: audit.id,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          displayValue: (audit.displayValue ?? "") + displaySuffix,
          items,
        };
      });

    // Extract opportunities
    const opportunityIds = [
      "render-blocking-resources",
      "unused-css-rules",
      "unused-javascript",
      "modern-image-formats",
      "offscreen-images",
      "unminified-css",
      "unminified-javascript",
      "efficient-animated-content",
      "duplicated-javascript",
      "legacy-javascript",
      "uses-optimized-images",
      "uses-responsive-images",
      "uses-text-compression",
      "server-response-time",
      "redirects",
      "preload-lcp-element",
      "uses-rel-preconnect",
    ];

    const opportunities: OpportunityItem[] = opportunityIds
      .map((id) => audits[id])
      .filter(Boolean)
      .filter((audit) => audit.score !== null && audit.score < 1)
      .map((audit) => {
        const items = truncateItems(audit);
        const totalCount = audit.details?.items?.length ?? 0;
        const displaySuffix =
          items && totalCount > items.length
            ? ` (showing top ${items.length} of ${totalCount})`
            : "";
        return {
          id: audit.id,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          savings: audit.displayValue,
          displayValue: (audit.displayValue ?? "") + displaySuffix,
          items,
        };
      });

    const networkRequests = extractNetworkRequests(audits);
    const scriptTreemap = extractScriptTreemap(audits);

    return {
      strategy,
      url: data.id || url,
      fetchTime: lighthouse?.fetchTime || new Date().toISOString(),
      overallScore: (lighthouse?.categories?.performance?.score ?? 0) * 100,
      metrics,
      fieldData,
      diagnostics,
      opportunities,
      networkRequests,
      scriptTreemap,
    };
  }

  // All retries exhausted
  throw lastError ?? new Error("PSI fetch failed after all retries");
}
