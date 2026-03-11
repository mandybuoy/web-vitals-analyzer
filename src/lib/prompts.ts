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

Your task: produce a thorough root-cause analysis identifying WHY each Core Web Vital (INP, LCP, CLS) is performing as it is, and provide actionable, code-level fixes a developer can immediately implement.

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
        "code_example": string | null,
        "impact_metric": string,
        "severity": "critical" | "high" | "medium" | "low",
        "difficulty": "easy" | "moderate" | "hard",
        "is_generic_example": boolean,
        "is_observation": boolean,
        "trade_off": string | null,
        "evidence_basis": "measured" | "inferred" | "best_practice"
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
      "fix": string,
      "code_example": string | null,
      "trade_off": string | null
    }
  ],
  "priority_table": [
    {
      "rank": number,
      "fix": string,
      "affects": ["INP" | "LCP" | "CLS"],
      "severity": "critical" | "high" | "medium" | "low",
      "difficulty": "easy" | "moderate" | "hard",
      "estimated_improvement": string,
      "evidence_basis": "measured" | "inferred" | "best_practice"
    }
  ]
}

CRITICAL data mapping rules:
- "performance_score" MUST equal the PSI "overallScore" value (already 0-100 scale). NEVER return 0 for performance_score — copy the exact value from the PSI data.
- "field_metrics" must use CrUX "fieldData" when present in PSI. When CrUX data is absent for a metric, set it to null.
- "lab_metrics" values (lcp, tbt, cls, fcp, si) must come from the PSI "metrics" section values.
- "device" MUST match the device specified in the input.

DATA INTEGRITY RULES:
1. You do NOT have access to JavaScript source code. You only have: (a) HTML structure with script tags and their src/async/defer attributes, (b) PSI diagnostics and opportunities, (c) raw <head> HTML, (d) extracted HTML signals. Do NOT fabricate code with invented function names like "updateUI()", "calculateLayout()", "rerenderList()", or "initializeApp()". Base first-party JS analysis ONLY on PSI diagnostics (TBT, main thread work, bootup time, unused JS bytes) and script loading attributes visible in HTML.
2. For first-party code_example: set is_generic_example to true. These are general optimization patterns, not based on actual source code. For third-party code_example referencing actual script URLs from the data: set is_generic_example to false.
3. If a resource is described as deferred, async, or non-render-blocking in the description, it CANNOT have "LCP" in impact_metric or in priority_table affects. impact_metric must be logically consistent with the description and loading strategy.
4. Before outputting, verify cross-card consistency: if one issue states "no render-blocking scripts detected", no other issue may identify render-blocking scripts as a problem. Statements in one analysis section must not contradict statements in another section.
5. If a third-party script appears in PSI diagnostics but is NOT found in the HTML source signals, note this as "Detected via PSI only (likely server-injected or dynamically loaded)" in the description.

OBSERVATION vs ISSUE RULES:
6. If no action is needed for a finding (e.g., "No significant main thread blocking detected", "LCP is already good"), set is_observation to true, severity to "low", and difficulty to "easy". These are informational status reports. Do NOT include observations in the priority_table.
7. If action IS needed, set is_observation to false.

EVIDENCE BASIS RULES:
8. Classify each issue's evidence_basis: "measured" = backed by specific PSI metric values (TBT, LCP, CLS numbers) or CrUX field data. "inferred" = deduced from HTML signals (script positions, missing attributes, image formats). "best_practice" = general recommendation without specific evidence from this page's data.
9. In priority_table, rank fixes with evidence_basis "measured" above "inferred", and "inferred" above "best_practice", within the same severity tier.

TRADE-OFF RULES:
10. Every actionable fix (is_observation=false) and third_party_matrix recommendation MUST include a trade_off describing potential downsides or risks. Examples: "Deferring analytics may cause early user interactions to go untracked", "Non-render-blocking fonts cause a flash of unstyled text (FOUT)", "Removing this tag manager will disable all dependent tracking pixels". Set trade_off to null ONLY when there is genuinely no downside.

ESTIMATED IMPROVEMENT RULES:
11. When estimating improvements, show arithmetic: current_value - estimated_savings = estimated_result. Be consistent — do not cite different base values for the same metric across issues. Do not claim total savings that exceed the current measured value.

Analysis guidelines:
- INP gets the deepest analysis. Consider: long tasks, event handlers, layout thrashing, third-party script blocking, main thread contention
- LCP analysis: consider server response time, render-blocking resources, image optimization, preloading, critical rendering path
- CLS analysis: consider unsized images, dynamic content injection, font loading (FOIT/FOUT), ads, embeds
- For third_party_matrix: evaluate EVERY third-party script found in the HTML signals or PSI diagnostics
- Priority table: rank ALL fixes by impact, starting with the highest-impact easiest fixes. Exclude observations.
- Use field metrics (CrUX p75) when available; fall back to lab metrics when field data is absent
- Ratings use underscores: "needs_improvement" (not hyphens)

Code-level fix requirements:
- The "fix" field should explain WHAT to do and WHY in plain English.
- The "code_example" field should contain a concrete, copy-pasteable code snippet showing the implementation.
- For third-party scripts: reference actual script URLs from the PSI/HTML data in code_example. Use "// BEFORE:" and "// AFTER:" format. Set is_generic_example to false.
- For first-party issues: code_example should show generic patterns (e.g., script defer attributes, preload hints, image optimization markup) using actual resource URLs from PSI data where available. Set is_generic_example to true. Do NOT invent JavaScript function names or application code.
- Examples of good code_example values:
  - HTML changes: '<img src="hero.webp" width="800" height="400" loading="eager" fetchpriority="high" decoding="async">'
  - Script loading: '// BEFORE:\\n<script src="https://example.com/analytics.js"></script>\\n// AFTER:\\n<script src="https://example.com/analytics.js" defer></script>'
  - CSS fixes: '.hero-image { content-visibility: auto; contain-intrinsic-size: 800px 400px; }'
  - Preloading: '<link rel="preload" href="/hero.webp" as="image" type="image/webp" fetchpriority="high">'
- Reference specific resource URLs found in the PSI data (e.g., actual image URLs, script URLs from diagnostics/opportunities).
- Set code_example to null ONLY when the fix is purely a server-side or infrastructure change with no client code.

Respond with ONLY the JSON object, no explanations.`;

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
    JSON.stringify(psiResult),
  ];

  if (extractedSignals) {
    parts.push("", "## HTML Source Signals", JSON.stringify(extractedSignals));
  }

  if (truncatedHead) {
    parts.push("", "## Raw <head> HTML", truncatedHead);
  }

  return {
    system: TIER2_SYSTEM_PROMPT,
    user: parts.join("\n"),
  };
}
