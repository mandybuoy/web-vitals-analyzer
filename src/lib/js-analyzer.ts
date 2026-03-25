// JS file analyzer — downloads top scripts and detects INP-impacting patterns

import type { ScriptImpactItem, JSAnalysisResult, JSPattern } from "./types";

const JS_FETCH_TIMEOUT_MS = 10_000;
const JS_MAX_SIZE_BYTES = 500 * 1024; // 500KB

/** Third-party CDN domains to skip (we only analyze first-party scripts) */
const THIRD_PARTY_DOMAINS = [
  "googleapis.com",
  "gstatic.com",
  "cdn.jsdelivr.net",
  "cdnjs.cloudflare.com",
  "unpkg.com",
  "ajax.googleapis.com",
  "googletagmanager.com",
  "google-analytics.com",
  "facebook.net",
  "fbcdn.net",
  "twitter.com",
  "hotjar.com",
  "clarity.ms",
  "doubleclick.net",
  "googlesyndication.com",
  "youtube.com",
  "vimeo.com",
  "maps.googleapis.com",
  "recaptcha.net",
  "bootstrapcdn.com",
  "fontawesome.com",
  "cloudflare.com",
  "wp.com",
  "gravatar.com",
];

function isThirdParty(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return THIRD_PARTY_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

// ----- Pattern definitions -----

interface PatternDef {
  type: string;
  description: string;
  suggestion: string;
  regex: RegExp;
  severity: "high" | "medium" | "low";
}

const PATTERN_DEFS: PatternDef[] = [
  {
    type: "forced-reflow",
    description:
      "Reads layout properties (offsetWidth/offsetHeight/getBoundingClientRect) which force synchronous reflow when interleaved with DOM writes",
    suggestion:
      "Batch DOM reads before writes. Use requestAnimationFrame to separate read and write phases, or use the ResizeObserver API instead.",
    regex:
      /\.(?:offsetWidth|offsetHeight|offsetTop|offsetLeft|clientWidth|clientHeight|scrollWidth|scrollHeight|getComputedStyle|getBoundingClientRect)\b/g,
    severity: "high",
  },
  {
    type: "sync-xhr",
    description:
      "Synchronous XMLHttpRequest blocks the main thread until the network request completes",
    suggestion: "Replace with async fetch() or XMLHttpRequest with async=true.",
    regex:
      /\.open\s*\(\s*["'][^"']*["']\s*,\s*["'][^"']*["']\s*,\s*false\s*\)/g,
    severity: "high",
  },
  {
    type: "document-write",
    description:
      "document.write() blocks HTML parsing and can cause full page re-render",
    suggestion:
      "Replace with DOM APIs (createElement, appendChild) or innerHTML on a specific element.",
    regex: /document\.write\s*\(/g,
    severity: "high",
  },
  {
    type: "eval-usage",
    description:
      "eval() or new Function() triggers code compilation on the main thread and prevents optimization",
    suggestion:
      "Refactor to avoid dynamic code evaluation. Parse JSON with JSON.parse(), use static imports.",
    regex: /\beval\s*\(|new\s+Function\s*\(/g,
    severity: "high",
  },
  {
    type: "unthrottled-scroll-resize",
    description:
      "Event listeners on scroll/resize without throttling fire on every frame, blocking main thread",
    suggestion:
      "Add passive: true to the listener options, or throttle/debounce the handler. Consider using IntersectionObserver for scroll-based visibility.",
    regex:
      /addEventListener\s*\(\s*["'](?:scroll|resize|mousemove|touchmove)["']/g,
    severity: "medium",
  },
  {
    type: "timer-scheduling",
    description:
      "setTimeout(fn, 0) or setInterval can cause task scheduling that competes with user interactions",
    suggestion:
      "Use requestAnimationFrame for visual updates, requestIdleCallback for non-urgent work, or scheduler.postTask() for prioritized tasks.",
    regex: /setTimeout\s*\([^,]+,\s*0\s*\)|setInterval\s*\(/g,
    severity: "low",
  },
  {
    type: "dom-querySelectorAll-loop",
    description:
      "querySelectorAll inside loops can trigger repeated DOM traversals causing layout thrashing",
    suggestion:
      "Cache the query result outside the loop. Use event delegation instead of attaching handlers to each element.",
    regex:
      /(?:for|while|forEach|map)\s*[\s\S]{0,30}querySelectorAll|querySelectorAll[\s\S]{0,30}(?:for|while|forEach|map)/g,
    severity: "medium",
  },
];

function extractEvidence(code: string, matchIndex: number): string {
  const start = Math.max(0, matchIndex - 40);
  const end = Math.min(code.length, matchIndex + 60);
  let snippet = code.slice(start, end).trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < code.length) snippet = snippet + "...";
  // Collapse whitespace for readability
  return snippet.replace(/\s+/g, " ");
}

function analyzeCode(code: string): JSPattern[] {
  const patterns: JSPattern[] = [];
  const seen = new Set<string>();

  PATTERN_DEFS.forEach((def) => {
    // Reset regex state
    def.regex.lastIndex = 0;
    const match = def.regex.exec(code);
    if (match && !seen.has(def.type)) {
      seen.add(def.type);
      patterns.push({
        type: def.type,
        description: def.description,
        evidence: extractEvidence(code, match.index),
        suggestion: def.suggestion,
      });
    }
  });

  return patterns;
}

/** Reject URLs that could cause SSRF (private IPs, non-HTTP schemes) */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow HTTP/HTTPS
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const hostname = parsed.hostname;
    // Reject localhost and loopback
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0"
    ) {
      return false;
    }
    // Reject private IP ranges
    const parts = hostname.split(".");
    if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
      const first = parseInt(parts[0]);
      const second = parseInt(parts[1]);
      if (first === 10) return false; // 10.x.x.x
      if (first === 172 && second >= 16 && second <= 31) return false; // 172.16-31.x.x
      if (first === 192 && second === 168) return false; // 192.168.x.x
      if (first === 169 && second === 254) return false; // 169.254.x.x (link-local)
    }
    return true;
  } catch {
    return false;
  }
}

async function fetchJSFile(
  url: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!isSafeUrl(url)) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), JS_FETCH_TIMEOUT_MS);

    // Combine external signal with our timeout
    if (signal) {
      signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "*/*",
        },
        signal: controller.signal,
      });

      if (!response.ok) return null;

      // Check content length header
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > JS_MAX_SIZE_BYTES) {
        return null;
      }

      // Stream-read with size limit to avoid excessive memory for large files
      const reader = response.body?.getReader();
      if (!reader) return null;

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > JS_MAX_SIZE_BYTES) {
          reader.cancel();
          break;
        }
        chunks.push(value);
      }

      const decoder = new TextDecoder();
      return (
        chunks.map((c) => decoder.decode(c, { stream: true })).join("") +
        decoder.decode()
      );
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

/**
 * Analyze top 1-2 first-party scripts for INP-impacting patterns.
 * Downloads scripts and runs deterministic pattern detection.
 */
export async function analyzeTopScripts(
  scriptSummary: ScriptImpactItem[],
  signal?: AbortSignal,
): Promise<JSAnalysisResult[]> {
  if (!scriptSummary || scriptSummary.length === 0) return [];

  // Filter to first-party scripts, sorted by main thread time (desc)
  const candidates = scriptSummary
    .filter((s) => s.url && !isThirdParty(s.url))
    .sort((a, b) => (b.mainThreadTime ?? 0) - (a.mainThreadTime ?? 0))
    .slice(0, 2); // Top 2

  if (candidates.length === 0) return [];

  const results: JSAnalysisResult[] = [];

  // Fetch and analyze in parallel
  const analyses = await Promise.all(
    candidates.map(async (script) => {
      const code = await fetchJSFile(script.url, signal);
      if (!code) return null;

      const patterns = analyzeCode(code);

      return {
        url: script.url,
        sizeBytes: script.totalBytes,
        mainThreadTime: script.mainThreadTime ?? 0,
        patterns,
      };
    }),
  );

  analyses.forEach((result) => {
    if (result) results.push(result);
  });

  return results;
}
