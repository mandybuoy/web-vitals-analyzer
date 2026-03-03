// HTML fetcher — downloads target URL HTML for LLM signal extraction

const TIMEOUT_MS = 15_000;
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export interface FetchedHTML {
  fullHtml: string;
  head: string;
  sizeBytes: number;
  fetchTimeMs: number;
}

export async function fetchHTML(url: string): Promise<FetchedHTML> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const startTime = Date.now();

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "VitalScan/2.0 (Web Vitals Analyzer; +https://vitalscan.dev)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    });

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
