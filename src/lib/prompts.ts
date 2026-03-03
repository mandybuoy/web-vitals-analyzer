// Prompt templates for LLM calls

import type { PSIResult, ExtractedSignals } from "./types";

const HTML_HEAD_LIMIT = 15_000; // chars of <head> sent to Opus
const HTML_BODY_LIMIT = 50_000; // chars of body sent to Sonnet

// ----- HTML Signal Extraction (Sonnet) -----

const EXTRACTION_SYSTEM_PROMPT = `You are a web performance analysis tool. Extract structured performance signals from the provided HTML source code.

Return a JSON object matching this exact schema:

{
  "dom_stats": {
    "html_size_bytes": number,
    "estimated_dom_nodes": number,
    "anchor_count": number,
    "form_element_count": number,
    "img_total": number,
    "img_without_dimensions": number,
    "img_lazy_loaded": number,
    "picture_elements": number
  },
  "scripts": {
    "total": number,
    "render_blocking": [{ "src": string, "position": "head" | "body" }],
    "async_scripts": [{ "src": string }],
    "defer_scripts": [{ "src": string }],
    "inline_script_count": number,
    "inline_script_size_bytes": number
  },
  "css": {
    "stylesheet_count": number,
    "inline_style_blocks": number,
    "has_critical_css_inlined": boolean
  },
  "fonts": {
    "preloaded": [string],
    "font_display_values": { "swap": number, "block": number, ... }
  },
  "third_party": {
    "domains": [string],
    "scripts": [{ "src": string, "position": "head" | "body", "loading": "sync" | "async" | "defer", "category": string }]
  },
  "patterns": {
    "fetchpriority_high_on_content": boolean,
    "image_formats": { "webp": number, "avif": number, "jpg": number, ... },
    "preconnect_hints": [string],
    "preload_hints_non_font": [string]
  },
  "lcp_candidates": {
    "hero_image_src": string | null,
    "hero_image_preloaded": boolean,
    "h1_text": string | null
  }
}

Rules:
- Count elements accurately by scanning the HTML
- A script is "render_blocking" if it's in <head> without async/defer attributes
- Classify third-party domains using known categories (analytics, tag_manager, advertising, cdn, social, chat, maps, fonts, consent, payments, monitoring, ab_testing)
- For img_without_dimensions: count <img> tags missing width or height attributes
- For hero_image: identify the likely LCP image (large above-fold image, often the first large <img> in main content)
- Respond with ONLY the JSON object, no explanations`;

export function buildExtractionPrompt(
  head: string,
  fullHtml: string,
): { system: string; user: string } {
  const truncatedBody = fullHtml.slice(0, HTML_BODY_LIMIT);

  return {
    system: EXTRACTION_SYSTEM_PROMPT,
    user: `Analyze this HTML and extract performance signals:\n\n${truncatedBody}`,
  };
}

// ----- Tier 2 Deep Analysis (Opus) -----

const TIER2_SYSTEM_PROMPT = `You are a Core Web Vitals expert performing deep root-cause analysis. You receive structured PageSpeed Insights data, CrUX field metrics, and HTML source signals for a single device type.

Your task: produce a thorough root-cause analysis identifying WHY each Core Web Vital (INP, LCP, CLS) is performing as it is, and provide actionable fixes.

Return a JSON object matching this exact schema:

{
  "device": "mobile" | "desktop",
  "field_metrics": {
    "lcp": { "p75": number, "rating": "good" | "needs_improvement" | "poor" } | null,
    "inp": { "p75": number, "rating": "good" | "needs_improvement" | "poor" } | null,
    "cls": { "p75": number, "rating": "good" | "needs_improvement" | "poor" } | null
  },
  "lab_metrics": {
    "performance_score": number,
    "lcp": number,
    "tbt": number,
    "cls": number,
    "fcp": number,
    "si": number
  },
  "inp_analysis": {
    "issues": [
      {
        "name": string,
        "type": "first_party" | "third_party",
        "description": string,
        "fix": string,
        "impact_metric": string,
        "severity": "critical" | "high" | "medium" | "low",
        "difficulty": "easy" | "moderate" | "hard"
      }
    ]
  },
  "lcp_analysis": {
    "issues": [...]
  },
  "cls_analysis": {
    "issues": [...]
  },
  "third_party_matrix": [
    {
      "script_name": string,
      "domain": string,
      "category": string,
      "loading": string,
      "lcp_impact": "critical" | "high" | "medium" | "low",
      "cls_impact": "critical" | "high" | "medium" | "low",
      "inp_impact": "critical" | "high" | "medium" | "low",
      "recommendation": "remove" | "defer" | "lazy_load" | "keep",
      "fix": string
    }
  ],
  "priority_table": [
    {
      "rank": number,
      "fix": string,
      "affects": ["INP" | "LCP" | "CLS"],
      "severity": "critical" | "high" | "medium" | "low",
      "difficulty": "easy" | "moderate" | "hard",
      "estimated_improvement": string
    }
  ]
}

Analysis guidelines:
- INP gets the deepest analysis. Consider: long tasks, event handlers, layout thrashing, third-party script blocking, main thread contention
- LCP analysis: consider server response time, render-blocking resources, image optimization, preloading, critical rendering path
- CLS analysis: consider unsized images, dynamic content injection, font loading (FOIT/FOUT), ads, embeds
- For third_party_matrix: evaluate EVERY third-party script found in the HTML signals
- Priority table: rank ALL fixes by impact, starting with the highest-impact easiest fixes
- Be specific in fixes — include code snippets, attribute changes, or configuration details
- Use field metrics (CrUX p75) when available; fall back to lab metrics when field data is absent
- Ratings use underscores: "needs_improvement" (not hyphens)
- Respond with ONLY the JSON object, no explanations`;

export function buildTier2Prompt(
  psiResult: PSIResult,
  extractedSignals: ExtractedSignals | null,
  head: string,
  device: "mobile" | "desktop",
): { system: string; user: string } {
  const truncatedHead = head.slice(0, HTML_HEAD_LIMIT);

  const parts: string[] = [
    `## Device: ${device}`,
    "",
    "## PageSpeed Insights Data",
    JSON.stringify(psiResult, null, 2),
  ];

  if (extractedSignals) {
    parts.push(
      "",
      "## HTML Source Signals",
      JSON.stringify(extractedSignals, null, 2),
    );
  }

  if (truncatedHead) {
    parts.push("", "## Raw <head> HTML", truncatedHead);
  }

  return {
    system: TIER2_SYSTEM_PROMPT,
    user: parts.join("\n"),
  };
}
