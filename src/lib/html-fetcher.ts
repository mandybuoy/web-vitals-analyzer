// HTML fetcher — downloads target URL HTML for LLM signal extraction

const TIMEOUT_MS = 30_000;
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const CHROME_UA_ALT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

export interface FetchedHTML {
  fullHtml: string;
  head: string;
  sizeBytes: number;
  fetchTimeMs: number;
}

async function attemptFetch(
  url: string,
  userAgent: string,
  timeoutMs: number,
): Promise<FetchedHTML> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const startTime = Date.now();

    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (response.status === 403 || response.status === 503) {
      throw new BotBlockedError(
        `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check content type
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("xhtml")) {
      throw new Error(`Non-HTML content type: ${contentType}`);
    }

    // Stream-read with size limit
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_SIZE_BYTES) {
        reader.cancel();
        break;
      }
      chunks.push(value);
    }

    const decoder = new TextDecoder();
    const fullHtml =
      chunks.map((c) => decoder.decode(c, { stream: true })).join("") +
      decoder.decode();

    // Extract <head> section
    const headMatch = fullHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const head = headMatch ? headMatch[0] : "";

    return {
      fullHtml,
      head,
      sizeBytes: totalBytes,
      fetchTimeMs: Date.now() - startTime,
    };
  } finally {
    clearTimeout(timeout);
  }
}

class BotBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BotBlockedError";
  }
}

export async function fetchHTML(url: string): Promise<FetchedHTML> {
  try {
    return await attemptFetch(url, CHROME_UA, TIMEOUT_MS);
  } catch (err) {
    // Retry once with alternate UA on bot-block responses
    if (err instanceof BotBlockedError) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return await attemptFetch(url, CHROME_UA_ALT, TIMEOUT_MS);
    }
    throw err;
  }
}
