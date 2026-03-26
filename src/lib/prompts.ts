// Prompt templates for LLM calls

import type {
  PSIResult,
  ExtractedSignals,
  NetworkRequestItem,
  DuplicateResource,
} from "./types";

const HTML_HEAD_LIMIT = 15_000; // chars of <head> sent to Opus
const HTML_BODY_LIMIT = 50_000; // chars of body sent to Sonnet

// ----- HTML Signal Extraction (Sonnet) -----

export const DEFAULT_EXTRACTION_SYSTEM_PROMPT = `You are a web performance analysis tool. Extract structured performance signals from the provided HTML source code.

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
  systemPrompt?: string,
): { system: string; user: string } {
  const truncatedBody = fullHtml.slice(0, HTML_BODY_LIMIT);

  return {
    system: systemPrompt ?? DEFAULT_EXTRACTION_SYSTEM_PROMPT,
    user: `Analyze this HTML and extract performance signals:\n\n${truncatedBody}`,
  };
}

// ----- Tier 2 Deep Analysis (Opus) -----

export const DEFAULT_TIER2_SYSTEM_PROMPT = `You are a Core Web Vitals expert performing deep root-cause analysis. You receive structured PageSpeed Insights data, CrUX field metrics, and HTML source signals for a single device type.

Your task: produce a thorough root-cause analysis identifying WHY each Core Web Vital (INP, LCP, CLS) is performing as it is, and provide actionable, code-level fixes a developer can immediately implement.

Return a JSON object matching this exact schema:

{
  "device": "mobile" | "desktop",
  "field_metrics": {
    "lcp": { "p75": number, "rating": "good" | "needs_improvement" | "poor" } | null,
    "inp": { "p75": number, "rating": "good" | "needs_improvement" | "poor" } | null,
    "cls": { "p75": number, "rating": "good" | "needs_improvement" | "poor" } | null,
    "fcp": { "p75": number, "rating": "good" | "needs_improvement" | "poor" } | null
  },
  "lab_metrics": {
    "performance_score": number,
    "lcp": number,
    "tbt": number,
    "cls": number,
    "fcp": number,
    "si": number
  },
  "fcp_analysis": {
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
  "inp_analysis": {
    "issues": [...]
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
- FCP analysis: consider render-blocking resources (CSS and JS), server response time (TTFB), CSS complexity, font loading strategy (@font-face with font-display), critical rendering path length, and inline critical CSS. FCP is the first visual feedback — fixes here directly improve perceived speed.
- INP gets the deepest analysis. Consider: long tasks, event handlers, layout thrashing, third-party script blocking, main thread contention. When "## INP Deep Analysis Data" is provided, use the script treemap data to identify which specific JavaScript modules/chunks are contributing to main thread blocking. Cross-reference long task attributable URLs with treemap module names to pinpoint which modules within large bundles are likely causing INP issues. Include specific module names and sizes in your INP analysis issues.
- LCP analysis: consider server response time, render-blocking resources, image optimization, preloading, critical rendering path
- CLS analysis: consider unsized images, dynamic content injection, font loading (FOIT/FOUT), ads, embeds
- For third_party_matrix: evaluate EVERY third-party script found in the HTML signals or PSI diagnostics
- Priority table: rank ALL fixes by impact, starting with the highest-impact easiest fixes. Exclude observations.
- Use field metrics (CrUX p75) when available; fall back to lab metrics when field data is absent
- Ratings use underscores: "needs_improvement" (not hyphens)

TECHNICAL ACCURACY GUARDRAILS:
12. CSS CANNOT use the "defer" attribute. That is a script-only attribute. Valid techniques to defer non-critical CSS: (a) <link rel="preload" href="style.css" as="style" onload="this.rel='stylesheet'">, (b) <link rel="stylesheet" href="style.css" media="print" onload="this.media='all'">, (c) dynamically inject <link> via JavaScript after load. NEVER suggest "defer CSS" or "add defer to stylesheets" — these are technically invalid.
13. TTFB fixes MUST be specific to the detected tech stack. Name the CDN, caching strategy, SSR optimization, or server-side change. Examples: "Enable stale-while-revalidate on Cloudflare edge cache", "Add Redis caching for database queries in the WordPress backend", "Enable ISR (Incremental Static Regeneration) in Next.js for this route". "Reduce TTFB" or "Reduce server response time" alone is NOT acceptable as a recommendation.
14. Font reduction recommendations must distinguish functional fonts (body text, headings, UI elements) from decorative fonts before suggesting removal. Do NOT recommend reducing font count without identifying which specific fonts can be dropped and confirming they are not required by the site's design system.

CODE-LEVEL SPECIFICITY:
15. When PSI diagnostics/opportunities include items[] arrays with specific resource URLs and byte sizes, you MUST reference those specific resources in your analysis. Do NOT summarize them generically.
  - BAD: "Reduce unused JavaScript (500KB)"
  - GOOD: "Remove jquery-ui.min.js (180KB unused), owl.carousel.min.js (95KB unused), and daterangepicker.js (65KB unused) — loaded but not called on this page"
  - BAD: "Avoid enormous network payloads"
  - GOOD: "Google Maps API loaded 8 times via duplicate BranchLocator components at maps.googleapis.com — load once and share the instance"
16. Every entry in priority_table MUST reference specific URLs, file names, or library names from the provided PSI items[] data. Generic recommendations without specific resource references are NOT acceptable.
17. When items[] data is provided for an audit, base your analysis on the specific resources listed, not on the audit summary text alone.

TECH-STACK AWARENESS:
18. If a "## Detected Technology Stack" section is provided in the input, tailor all recommendations to that stack. Never suggest removing a resource that is a core dependency of the detected framework (e.g., do not suggest removing react-dom on a React site, or zone.js on an Angular site). If a "## Technology Stack Constraints (MUST FOLLOW)" section is provided, treat every constraint as a HARD RULE. Never suggest a technique listed as impossible or inapplicable for the detected stack.
19. When the detected stack has specific optimization patterns (e.g., Next.js Image component and next/dynamic, Angular lazy-loaded modules, WordPress object caching), reference those in your fix recommendations instead of generic advice.

DUPLICATE RESOURCE DETECTION:
20. If a "## Duplicate Resources Detected" section is provided, analyze each duplicate. Identify the likely cause (duplicate component mount, tag manager re-injection, missing singleton pattern, multiple entry points) and provide the specific fix. Include the URL and load count in your issue description.
21. Multiple analytics collection/beacon calls (e.g., google-analytics.com/collect, /g/collect, /j/collect) to the same endpoint are NORMAL operational behavior for analytics tracking. Only flag as duplicates if the exact same analytics library JS file (not collection endpoint) is loaded more than once.

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

// ----- Pre-processing helpers (deterministic, run before LLM) -----

// DuplicateResource interface is in types.ts
export type { DuplicateResource } from "./types";

/** Analytics beacon/collect URLs that fire multiple times by design — not true duplicates */
const ANALYTICS_BEACON_PATTERN =
  /\/collect\?|\/j\/collect|\/g\/collect|\/beacon|\/analytics\.js\/collect/;

/** Identify URLs loaded 2+ times from network requests */
export function findDuplicateResources(
  networkRequests?: NetworkRequestItem[],
): DuplicateResource[] {
  if (!networkRequests || networkRequests.length === 0) return [];

  const groups = new Map<
    string,
    { count: number; totalTransferSize: number; resourceType: string }
  >();

  networkRequests.forEach((req) => {
    // Skip analytics beacon/collect calls — multiple fires are normal
    if (ANALYTICS_BEACON_PATTERN.test(req.url)) return;

    const existing = groups.get(req.url);
    if (existing) {
      existing.count++;
      existing.totalTransferSize += req.transferSize;
    } else {
      groups.set(req.url, {
        count: 1,
        totalTransferSize: req.transferSize,
        resourceType: req.resourceType,
      });
    }
  });

  const duplicates: DuplicateResource[] = [];
  groups.forEach((val, url) => {
    if (val.count >= 2) {
      duplicates.push({ url, ...val });
    }
  });

  return duplicates.sort((a, b) => b.totalTransferSize - a.totalTransferSize);
}

/** Pattern-match script URLs and HTML signals to detect tech stack */
export function detectTechStack(
  extractedSignals: ExtractedSignals | null,
  networkRequests?: NetworkRequestItem[],
): string[] {
  const stack: Set<string> = new Set();
  const allUrls: string[] = [];

  // Gather URLs from network requests
  if (networkRequests) {
    networkRequests.forEach((req) => allUrls.push(req.url));
  }

  // Gather URLs from extracted signals
  if (extractedSignals) {
    extractedSignals.scripts.render_blocking.forEach((s) =>
      allUrls.push(s.src),
    );
    extractedSignals.scripts.async_scripts.forEach((s) => allUrls.push(s.src));
    extractedSignals.scripts.defer_scripts.forEach((s) => allUrls.push(s.src));
    extractedSignals.third_party.scripts.forEach((s) => allUrls.push(s.src));
  }

  const urlStr = allUrls.join(" ").toLowerCase();

  // Framework detection patterns
  const patterns: [RegExp, string][] = [
    [/\/_next\//, "Next.js"],
    [/react-dom|react\.production/, "React"],
    [/angular(\.min)?\.js|zone\.js/, "Angular"],
    [/vue(\.runtime)?(\.min)?\.js|\/nuxt\/|_nuxt/, "Vue.js/Nuxt"],
    [/jquery(\.min)?\.js|jquery-\d/, "jQuery"],
    [/wp-content|wp-includes/, "WordPress"],
    [/cdn\.shopify\.com/, "Shopify"],
    [/tailwindcss|tailwind/, "Tailwind CSS"],
    [/bootstrap(\.min)?\.js|bootstrap(\.min)?\.css/, "Bootstrap"],
    [/gatsby/, "Gatsby"],
    [/svelte/, "Svelte"],
    [/ember/, "Ember.js"],
  ];

  patterns.forEach(([pattern, name]) => {
    if (pattern.test(urlStr)) stack.add(name);
  });

  // Third-party tool detection
  const thirdPartyPatterns: [RegExp, string][] = [
    [/googletagmanager\.com|gtm\.js/, "Google Tag Manager"],
    [/google-analytics\.com\/|\/gtag\/js/, "Google Analytics"],
    [/connect\.facebook|fbevents/, "Facebook Pixel"],
    [/hotjar\.com/, "Hotjar"],
    [/visual-website-optimizer|vwo/, "VWO (A/B Testing)"],
    [/notifyvisitors/, "NotifyVisitors"],
    [/maps\.googleapis\.com|maps\.google/, "Google Maps"],
    [/cloudflare/, "Cloudflare"],
  ];

  thirdPartyPatterns.forEach(([pattern, name]) => {
    if (pattern.test(urlStr)) stack.add(name);
  });

  return Array.from(stack);
}

// ----- Tech stack constraint maps (hard rules injected into LLM prompt) -----

const TECH_STACK_CONSTRAINTS: Record<string, string> = {
  AEM: `AEM (Adobe Experience Manager):
- NEVER suggest adding defer or async attributes to CSS links — AEM clientlibs bundle CSS and loading cannot be controlled via HTML attributes.
- NEVER suggest adding defer or async attributes directly to script tags — AEM manages all JS loading through clientlib categories. To defer JS, recommend using the "async" or "defer" clientlib category configuration in the component's content.xml.
- For CSS optimization: recommend clientlib merging, reducing the number of clientlib categories, extracting critical CSS via AEM HTL (Sightly) templates, or enabling OOTB CSS minification in AEM's HTML Library Manager.
- For JS optimization: recommend async clientlib categories, conditional clientlib loading via HTL data-sly-use, or splitting large clientlibs into page-specific ones.
- For image optimization: recommend AEM Dynamic Media / Scene7 with smart imaging, or AEM Core Components' adaptive image servlet — NOT manual srcset or picture element changes.
- For caching: recommend Dispatcher cache rules, TTL headers at CDN/Dispatcher level, and Sling Content Distribution — NOT application-level caching code.`,

  WordPress: `WordPress:
- For script deferring: use wp_enqueue_script() with 'strategy' => 'defer' (WordPress 6.3+). Do NOT suggest manually adding defer attributes to script tags in theme templates.
- For CSS optimization: use wp_enqueue_style() with preload pattern via wp_style_add_data(), or recommend a critical CSS plugin (e.g., Autoptimize, WP Rocket critical CSS).
- For image optimization: WordPress natively adds loading="lazy" to images below the fold (WP 5.5+). For LCP images, recommend removing lazy loading via wp_img_tag_add_loading_optimization_attrs filter. Recommend WebP conversion via plugins (ShortPixel, Imagify).
- For caching: reference specific WP caching solutions — WP Rocket, W3 Total Cache, LiteSpeed Cache, or server-level caching (Varnish, Redis object cache).
- For fonts: use wp_enqueue_style() for Google Fonts with font-display swap, or recommend OMGF plugin for local hosting.`,

  Shopify: `Shopify:
- Theme customization is limited to theme.liquid and section/snippet files. Use content_for_header for critical resources and the Script Tag API for third-party scripts.
- CANNOT control third-party script loading order in the checkout flow — Shopify manages checkout scripts.
- For image optimization: use Shopify's image_url filter with width/height parameters (e.g., {{ image | image_url: width: 800 }}) and loading="lazy" on section images.
- For JS optimization: use Shopify's section rendering API for partial page updates, defer non-critical JS with script type="module", and leverage Shopify's built-in performance features.
- For CSS: recommend using Shopify's CSS API and purging unused CSS from theme stylesheets. Inline critical CSS in theme.liquid <head>.`,

  "Next.js": `Next.js:
- For image optimization: ALWAYS recommend next/image component with priority prop for LCP images, automatic WebP/AVIF, and built-in lazy loading.
- For code splitting: use next/dynamic for component-level code splitting with ssr: false option for client-only components. Use route-level code splitting (automatic with App Router).
- For font optimization: use next/font for zero-layout-shift font loading with automatic font-display: swap.
- For caching: recommend ISR (Incremental Static Regeneration) with revalidate, or static generation for unchanging pages. Use fetch() cache options in Server Components.
- For third-party scripts: use next/script with strategy="lazyOnload" or strategy="afterInteractive".`,

  Angular: `Angular:
- For code splitting: use lazy-loaded routes with loadChildren/loadComponent. Use @defer blocks (Angular 17+) for template-level lazy loading.
- For image optimization: use NgOptimizedImage directive with priority attribute for LCP images and automatic lazy loading.
- For build optimization: use Angular CLI budgets to enforce bundle size limits. Enable build optimizer and AOT compilation (default in production).
- For INP: use OnPush change detection strategy, trackBy on ngFor, and avoid synchronous computations in templates.
- NEVER suggest removing zone.js unless the app explicitly uses zoneless change detection (Angular 18+ experimental).`,

  React: `React:
- For code splitting: use React.lazy() + Suspense for component-level splitting. Use dynamic import() for route-level splitting.
- For INP: use useMemo/useCallback to prevent expensive re-renders, useTransition for non-urgent state updates, and useDeferredValue for expensive computations.
- For rendering: recommend React Server Components (if using a meta-framework), or Concurrent Features for better interactivity.
- NEVER suggest removing react-dom or react — they are core dependencies.`,

  "Vue.js/Nuxt": `Vue.js / Nuxt:
- For code splitting: use defineAsyncComponent for component-level lazy loading. In Nuxt, use lazy prefix on auto-imported components.
- For data fetching: use Nuxt's useAsyncData or useFetch with server: true for SSR data loading.
- For image optimization: use <NuxtImage> or <NuxtPicture> components with Nuxt Image module.
- For caching: use Nuxt's routeRules for per-route caching strategies (ISR, SWR, static).
- For INP: use v-memo directive for expensive list renders, computed properties over methods in templates, and shallowRef for large objects.`,
};

/** Map UI labels and auto-detect names to constraint keys */
const TECH_STACK_ALIASES: Record<string, string> = {
  Vue: "Vue.js/Nuxt",
  "Vue.js": "Vue.js/Nuxt",
  Nuxt: "Vue.js/Nuxt",
  "Nuxt.js": "Vue.js/Nuxt",
};

/** Build tech-stack-specific constraint block for LLM prompt */
export function getTechStackConstraints(techStack: string[]): string {
  const blocks: string[] = [];
  const seen = new Set<string>();
  techStack.forEach((stack) => {
    const key = TECH_STACK_ALIASES[stack] ?? stack;
    if (seen.has(key)) return;
    seen.add(key);
    const constraint = TECH_STACK_CONSTRAINTS[key];
    if (constraint) {
      blocks.push(constraint);
    }
  });
  return blocks.join("\n\n");
}

export function buildTier2Prompt(
  psiResult: PSIResult,
  extractedSignals: ExtractedSignals | null,
  head: string,
  device: "mobile" | "desktop",
  systemPrompt?: string,
  preComputed?: {
    techStack?: string[];
    duplicates?: DuplicateResource[];
  },
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

  // Tech stack (pre-computed or auto-detected)
  const techStack =
    preComputed?.techStack ??
    detectTechStack(extractedSignals, psiResult.networkRequests);
  if (techStack.length > 0) {
    parts.push("", "## Detected Technology Stack", JSON.stringify(techStack));

    // Inject hard constraints for known tech stacks
    const constraints = getTechStackConstraints(techStack);
    if (constraints) {
      parts.push(
        "",
        "## Technology Stack Constraints (MUST FOLLOW)",
        constraints,
      );
    }
  }

  // Duplicates (pre-computed or auto-detected)
  const duplicates =
    preComputed?.duplicates ??
    findDuplicateResources(psiResult.networkRequests);
  if (duplicates.length > 0) {
    parts.push(
      "",
      "## Duplicate Resources Detected",
      "The following URLs were loaded multiple times on this page:",
      JSON.stringify(duplicates),
    );
  }

  // INP deep analysis data (script treemap + long tasks)
  const longTasks =
    psiResult.diagnostics
      .find((d) => d.id === "long-tasks")
      ?.items?.filter((item) => item.url && item.wastedMs)
      .slice(0, 10) ?? [];
  if (longTasks.length > 0 || psiResult.scriptTreemap) {
    parts.push("", "## INP Deep Analysis Data");
    if (longTasks.length > 0) {
      parts.push(
        "### Long Tasks (tasks >50ms blocking main thread)",
        JSON.stringify(longTasks),
      );
    }
    if (psiResult.scriptTreemap) {
      parts.push(
        "### Script Treemap (module-level JS breakdown)",
        JSON.stringify(psiResult.scriptTreemap),
      );
    }
  }

  if (truncatedHead) {
    parts.push("", "## Raw <head> HTML", truncatedHead);
  }

  return {
    system: systemPrompt ?? DEFAULT_TIER2_SYSTEM_PROMPT,
    user: parts.join("\n"),
  };
}
