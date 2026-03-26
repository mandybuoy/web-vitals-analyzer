// Network stack / CDN detection from HTTP response headers

import type { NetworkStackInfo } from "./types";

interface CDNSignature {
  name: string;
  detect: (headers: Record<string, string>) => boolean;
}

const CDN_SIGNATURES: CDNSignature[] = [
  {
    name: "Cloudflare",
    detect: (h) => "cf-ray" in h || h["server"]?.toLowerCase() === "cloudflare",
  },
  {
    name: "Akamai",
    detect: (h) =>
      "x-akamai-transformed" in h ||
      "x-akamai-request-id" in h ||
      (h["server"]?.toLowerCase().includes("akamai") ?? false),
  },
  {
    name: "AWS CloudFront",
    detect: (h) =>
      "x-amz-cf-id" in h ||
      "x-amz-cf-pop" in h ||
      (h["via"]?.includes("CloudFront") ?? false),
  },
  {
    name: "Fastly",
    detect: (h) =>
      (h["x-served-by"]?.includes("cache-") ?? false) ||
      "x-fastly-request-id" in h,
  },
  {
    name: "Vercel",
    detect: (h) =>
      "x-vercel-id" in h || h["server"]?.toLowerCase() === "vercel",
  },
  {
    name: "Netlify",
    detect: (h) =>
      "x-nf-request-id" in h || h["server"]?.toLowerCase() === "netlify",
  },
  {
    name: "Azure CDN",
    detect: (h) => "x-azure-ref" in h || "x-ms-ref" in h,
  },
  {
    name: "Google Cloud CDN",
    detect: (h) =>
      (h["via"]?.toLowerCase().includes("google") ?? false) &&
      !("x-amz-cf-id" in h), // exclude CloudFront via google proxy
  },
  {
    name: "KeyCDN",
    detect: (h) => "x-pull" in h || "x-edge-location" in h,
  },
  {
    name: "Sucuri",
    detect: (h) =>
      "x-sucuri-id" in h ||
      (h["server"]?.toLowerCase().includes("sucuri") ?? false),
  },
  {
    name: "Imperva/Incapsula",
    detect: (h) => "x-iinfo" in h || "x-cdn" in h,
  },
];

/** Detect CDN, server, compression, and cache status from response headers */
export function detectNetworkStack(
  headers?: Record<string, string>,
): NetworkStackInfo | undefined {
  if (!headers || Object.keys(headers).length === 0) return undefined;

  // Normalize header keys to lowercase
  const normalized: Record<string, string> = {};
  Object.entries(headers).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = value;
  });

  // Detect CDN
  let cdn: string | undefined;
  for (const sig of CDN_SIGNATURES) {
    if (sig.detect(normalized)) {
      cdn = sig.name;
      break;
    }
  }

  // Detect server
  const server = normalized["server"] || undefined;

  // Detect compression
  const compression = normalized["content-encoding"] || undefined;

  // Detect cache status
  const cacheStatus =
    normalized["x-cache"] ||
    normalized["cf-cache-status"] ||
    normalized["x-vercel-cache"] ||
    normalized["x-cache-status"] ||
    undefined;

  // Collect interesting headers subset
  const interestingKeys = [
    "server",
    "via",
    "x-cache",
    "cf-cache-status",
    "x-vercel-cache",
    "content-encoding",
    "x-powered-by",
    "x-served-by",
    "alt-svc",
    "strict-transport-security",
    "x-frame-options",
    "content-security-policy",
  ];

  const subset: Record<string, string> = {};
  interestingKeys.forEach((key) => {
    if (normalized[key]) {
      subset[key] = normalized[key];
    }
  });

  return {
    cdn,
    server,
    compression,
    cacheStatus,
    headers: subset,
  };
}
