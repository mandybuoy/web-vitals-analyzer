# Core Web Vitals Intelligence Platform — POC Summary

## What We Built

A self-hosted web performance analysis tool that takes a URL, collects real-user and lab metrics via Google PSI (with CrUX field data), fetches the page source, and runs two-tier LLM analysis to produce specific, code-level fix recommendations.

## Week 1 — Data Collection & Scoring

- PSI + CrUX pipeline: collects LCP, INP, CLS, FCP, TTFB with p75 values, distributions, and category ratings
- Graceful fallback when CrUX field data is unavailable (low-traffic pages)
- Scoring logic with good/needs-improvement/poor classification per metric
- Mobile + desktop analysis in parallel

## Week 2 — AI-Powered Recommendations

- Raw HTML fetch with bot-block retry and fallback strategies
- Two-tier LLM analysis: Tier 1 (extraction) parses metrics + issues from raw data; Tier 2 (intelligence) generates root-cause analysis with code-level fixes
- Third-party script detection: 88-domain classification DB across 13 categories (analytics, ads, A/B testing, chat, etc.)
- Tech stack detection (AEM, WordPress, Shopify, Next.js, Angular, React, Vue) with framework-specific fix recommendations
- JS file analysis for INP: downloads top first-party scripts, detects forced reflows, sync XHR, document.write, eval, unthrottled listeners
- CDN/network stack detection from response headers

## Week 3 — Real-World Validation & Dashboard

- Tested across client URLs including heavy AEM sites, SPAs, and low-traffic pages
- Timeout hardening: 8-min pipeline budget, partial report fallback when PSI fails but HTML extraction succeeds, false stall detection fixes for heavy sites
- Third-party impact matrix: sortable table showing per-script LCP/CLS/INP severity, action recommendation (remove/defer/lazy-load/keep), code examples, and trade-off notes
- INP deep-dive tab: phase breakdown (input delay / processing / presentation), element-level risk table, script main-thread time from PSI bootup audit
- Duplicate analytics detection: identifies redundant gtag/GA4/pixel fires with beacon-level filtering
- History list with pagination for reviewing past scans
- Comparison dashboard for tracking score changes across runs

## Week 4 — Feedback & Finalization

- Incorporated client feedback on recommendation quality and output consistency
- Tightened LLM prompts: tech stack hard constraints injected as MUST FOLLOW rules, stripped unnecessary data from prompt payload to reduce noise
- Switched to Sonnet 4.6 for better output quality
- Documented known limitations (below)

## Known Limitations

1. **CrUX coverage gaps** — Low-traffic or newly launched URLs return no field data. Analysis falls back to lab-only metrics, which don't reflect real-user experience.
2. **LLM output variance** — Recommendations can vary between runs for the same URL. Prompt constraints reduce this but don't eliminate it.
3. **Third-party impact is qualitative** — Impact severity (critical/high/medium/low) comes from LLM judgment, not measured blocking time. No numerical impact scoring.
4. **No SPA route-level analysis** — For single-page apps, only the initial load is analyzed. Client-side navigations and route-level INP are not captured.
5. **PSI rate limits** — Google PSI API has per-key quotas. High-volume scanning requires key rotation or quota increases.
6. **JS analysis is heuristic** — First-party script analysis uses pattern matching (regex for forced reflows, sync XHR, etc.), not AST parsing. Can miss obfuscated patterns or produce false positives in bundled code.
7. **Minified code is opaque** — Production bundles are minified and often mangled. Regex-based detection can't reliably map patterns back to original source. Source maps are not fetched or used, so recommendations reference minified identifiers rather than authored code.
8. **Large bundles exceed analysis limits** — Heavily bundled sites (e.g., large AEM/enterprise SPAs) can produce JS files that exceed the token window when fed to the LLM. Only the top 1-2 scripts are downloaded and analyzed; the rest are skipped entirely. Webpack/Rollup chunk splitting means the problematic code may live in a chunk we never see.
