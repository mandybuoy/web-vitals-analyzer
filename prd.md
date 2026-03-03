# PRD: CWV Analyzer

## What This Is

A self-hosted tool where you paste a URL, it analyzes Core Web Vitals performance, and outputs an interactive HTML report with root causes and prioritized fixes. Heavy focus on INP, secondary on LCP and CLS.

## User Flow

```
1. User opens web UI
2. Pastes a URL, picks device (mobile/desktop/both)
3. Clicks "Analyze"
4. Progress bar shows stages: Collecting → Extracting → Analyzing → Generating
5. Report renders inline — tabbed view: INP | LCP | CLS | Third-Party | Priority Table
6. User can re-analyze or enter a new URL
```

---

## Architecture

```
┌─────────────────────────────┐
│  React Frontend (Vite)      │
│  - URL input + device pick  │
│  - Progress/status display  │
│  - Interactive report viewer│
└─────────┬───────────────────┘
          │ REST API
┌─────────▼───────────────────┐
│  Python Backend (FastAPI)   │
│                             │
│  /api/analyze  POST         │
│  /api/status/:id  GET       │
│  /api/report/:id  GET       │
│  /api/settings  GET/PUT     │
│                             │
│  Pipeline Orchestrator      │
│  Cost Tracking Middleware   │
└─────────────────────────────┘
```

---

## Backend Pipeline

The backend runs a 4-stage pipeline for each analysis request.

### Stage 1: Data Collection (no LLM)

Parallel execution:

| Call       | What                                         | Returns                                                      |
| ---------- | -------------------------------------------- | ------------------------------------------------------------ |
| CrUX API   | Field metrics for the URL (mobile + desktop) | LCP, INP, CLS, TTFB, FCP — p75 values + distribution buckets |
| PSI API    | Lab audit (mobile + desktop)                 | Lighthouse scores + all audit diagnostics JSON               |
| HTTP fetch | Raw HTML source of the URL                   | Full HTML string                                             |

CrUX may return empty for low-traffic URLs. Handle gracefully: proceed with PSI + HTML only, flag "No field data" in report.

### Stage 2: Source Extraction (no LLM)

Parse the raw HTML server-side using Python (BeautifulSoup or similar). Extract structured signals:

```python
{
  "dom_stats": {
    "html_size_bytes": 1452582,
    "estimated_dom_nodes": 9100,      # count tags
    "anchor_count": 1054,
    "form_element_count": 184,
    "img_total": 256,
    "img_without_dimensions": 187,
    "img_lazy_loaded": 188,           # data-src or loading="lazy"
    "picture_elements": 0,            # <picture> / srcset usage
  },
  "scripts": {
    "total": 48,
    "render_blocking": [...],         # in <head>, no async/defer
    "async_scripts": [...],
    "defer_scripts": [...],
    "inline_script_size_bytes": 4475,
  },
  "css": {
    "stylesheet_count": 13,
    "inline_style_blocks": 1,
    "has_critical_css_inlined": false,
  },
  "fonts": {
    "preloaded": [...],               # rel="preload" as="font"
    "font_display_values": {"swap": 7},
  },
  "third_party": {
    "domains": [...],                 # all non-origin domains
    "scripts": [                      # per-script detail
      {
        "src": "https://dev.visualwebsiteoptimizer.com/...",
        "position": "head",
        "loading": "sync",
        "category": "ab_testing"      # rule-based classification
      }
    ]
  },
  "patterns": {
    "google_maps_loads": 8,
    "accordion_collapse_count": 78,
    "carousel_containers": 3,
    "fetchpriority_high_on_content": false,
    "image_formats": {"png": 186, "svg": 53, "jpg": 4, "webp": 0},
    "preconnect_hints": [...],
    "preload_hints_non_font": [],
    "dynamic_injection_patterns": {"appendChild": 9, "insertBefore": 3},
  },
  "lcp_candidates": {
    "hero_image_src": "/content/dam/.../ad-banner.jpg",
    "hero_image_is_css_bg": true,
    "hero_image_preloaded": false,
    "h1_text": "Make a Claim",
    "h1_uses_custom_font": true,
  }
}
```

Third-party classification is rule-based (a lookup dict of known domains → categories). No LLM needed here.

### Stage 3: LLM Analysis (two-tier)

**Tier 1 — Extraction Model (Sonnet-class, configurable)**

Purpose: Take the PSI audit JSON (which is huge, 30-60K tokens) and extract a condensed structured summary of what PSI flagged.

```
Input:  PSI audit JSON (raw)
Prompt: "Extract all audit failures and opportunities from this PSI result.
         Return JSON: [{audit_id, title, score, savings_ms, savings_bytes, details}]"
Output: Condensed PSI findings (~2-3K tokens)
```

This reduces the PSI payload from ~40K tokens to ~3K before sending to the expensive model.

**Tier 2 — Intelligence Model (Opus-class, configurable)**

Purpose: Deep root-cause analysis and fix recommendations.

```
Input:
  - CrUX metrics (field data)
  - Condensed PSI findings (from Tier 1)
  - Extracted source signals (from Stage 2)
  - Raw HTML <head> section (for exact script/CSS order analysis)

Prompt: Structured analysis prompt requesting:
  1. INP root causes (first-party + third-party, each with description, fix, impact, difficulty)
  2. LCP root causes (same structure)
  3. CLS root causes (same structure)
  4. Third-party impact matrix
  5. Priority-sorted fix table

Output format: JSON matching the report schema (see Report Structure below)
```

The prompt must instruct the model to output strict JSON. Include few-shot examples of the expected output structure in the system prompt.

### Stage 4: Report Assembly (no LLM)

Take the JSON from Stage 3 and store it. The frontend renders it into the interactive report.

---

## Cost Tracking Middleware

Every OpenRouter call goes through a wrapper that logs:

```python
{
  "analysis_id": "uuid",
  "timestamp": "ISO",
  "tier": "extraction" | "intelligence",
  "model": "anthropic/claude-sonnet-4",
  "input_tokens": 45000,
  "output_tokens": 3000,
  "cost_input": 0.135,     # input_tokens * price_per_M / 1_000_000
  "cost_output": 0.045,
  "cost_total": 0.18,
  "latency_ms": 12400
}
```

Model pricing is a config dict (pulled from OpenRouter's `/api/v1/models` endpoint or hardcoded with manual override). Store per-analysis and aggregate.

Exposed in the UI under Settings as a collapsible "Cost Tracker" panel showing: total spend, per-analysis breakdown, model usage split.

---

## Report Structure (JSON Schema)

This is what the Tier 2 LLM must return and what the frontend renders:

```json
{
  "url": "https://www.hdfclife.com/claims",
  "device": "mobile",
  "timestamp": "ISO",
  "field_metrics": {
    "lcp": { "p75": 4200, "rating": "poor" },
    "inp": { "p75": 680, "rating": "poor" },
    "cls": { "p75": 0.18, "rating": "needs_improvement" }
  },
  "lab_metrics": {
    "performance_score": 32,
    "lcp": 5800,
    "tbt": 2400,
    "cls": 0.22,
    "fcp": 3200,
    "si": 6100
  },
  "source_stats": {
    "dom_nodes": 9100,
    "html_size_kb": 1420,
    "total_scripts": 48,
    "render_blocking_scripts": 3,
    "stylesheets": 13,
    "total_images": 256,
    "images_without_dimensions": 187,
    "third_party_domains": 10
  },
  "inp_analysis": {
    "issues": [
      {
        "name": "string",
        "type": "first_party | third_party",
        "description": "string",
        "fix": "string",
        "impact_metric": "string — quantitative before/after",
        "severity": "critical | high | medium | low",
        "difficulty": "easy | moderate | hard"
      }
    ]
  },
  "lcp_analysis": {
    "issues": [
      {
        "name": "string",
        "type": "first_party | third_party",
        "description": "string",
        "fix": "string",
        "impact_metric": "string — quantitative before/after",
        "severity": "critical | high | medium | low",
        "difficulty": "easy | moderate | hard"
      }
    ]
  },
  "cls_analysis": {
    "issues": [
      {
        "name": "string",
        "type": "first_party | third_party",
        "description": "string",
        "fix": "string",
        "impact_metric": "string — quantitative before/after",
        "severity": "critical | high | medium | low",
        "difficulty": "easy | moderate | hard"
      }
    ]
  },
  "third_party_matrix": [
    {
      "script_name": "VWO",
      "domain": "dev.visualwebsiteoptimizer.com",
      "category": "A/B Testing",
      "loading": "sync, head",
      "lcp_impact": "critical",
      "cls_impact": "critical",
      "inp_impact": "high",
      "recommendation": "remove | defer | keep",
      "fix": "string"
    }
  ],
  "priority_table": [
    {
      "rank": 1,
      "fix": "string — short description",
      "affects": ["INP", "LCP", "CLS"],
      "severity": "critical",
      "difficulty": "easy",
      "estimated_improvement": "string"
    }
  ]
}
```

---

## Frontend

### Tech

React + Vite + Tailwind. Single page app. No routing needed.

### Screens

**1. Input Screen**

- URL text input (validated: must be https:// or http://)
- Device toggle: Mobile | Desktop | Both
- "Analyze" button
- Below: last 10 analyses as a simple list (clickable to re-view report)

**2. Progress Screen**

- 4-step progress bar: Collecting → Extracting → Analyzing → Generating
- Each step shows elapsed time
- Cancel button

**3. Report Screen**

Top section — summary cards:

- LCP value + rating pill (good/needs-improvement/poor)
- INP value + rating pill
- CLS value + rating pill
- DOM nodes, HTML size, total scripts, 3P domains (secondary stats)

Tab bar: **INP** | **LCP** | **CLS** | **Third-Party** | **Priority**

INP tab (default active, gets visual emphasis):

- Two sub-sections: "First-Party Issues" and "Third-Party Issues"
- Each issue is a card or expandable row with: name, description, fix, impact metric, severity pill, difficulty pill
- Sorted by severity descending

LCP tab: Same layout as INP tab.

CLS tab: Same layout as INP tab.

Third-Party tab:

- Table with columns: Script, Category, Loading, LCP Impact, CLS Impact, INP Impact, Action, Fix
- Each impact cell is a colored pill (critical/high/medium/low)
- Sortable by any column

Priority tab:

- Single table, all fixes across all metrics, sorted by: severity desc → difficulty asc
- Columns: Rank, Fix, Affects (metric pills), Severity, Difficulty, Est. Improvement
- This is the "executive summary" view

**4. Settings (gear icon, slide-out panel)**

- OpenRouter API key (stored in .env on backend, editable here)
- Google API key (same)
- Extraction model: dropdown (default: anthropic/claude-sonnet-4-5-20250929)
- Intelligence model: dropdown (default: anthropic/claude-opus-4-6)
- Cost Tracker (collapsible sub-panel):
  - Total spend across all analyses
  - Table: Analysis ID | URL | Date | Extraction cost | Intelligence cost | Total

---

## API Endpoints

```
POST /api/analyze
  Body: { url: string, device: "mobile" | "desktop" | "both" }
  Returns: { analysis_id: string }
  Kicks off async pipeline.

GET /api/status/{analysis_id}
  Returns: { stage: 1|2|3|4, stage_name: string, progress_pct: number, error?: string }
  Frontend polls this every 2s.

GET /api/report/{analysis_id}
  Returns: Full report JSON (schema above).

GET /api/settings
  Returns: { extraction_model, intelligence_model, costs: [...] }

PUT /api/settings
  Body: { extraction_model?, intelligence_model? }
  Updates model selection.

GET /api/history
  Returns: [{ analysis_id, url, device, timestamp, inp_rating, lcp_rating, cls_rating }]
  Last 50 analyses.
```

---

## File Structure

```
cwv-analyzer/
├── backend/
│   ├── main.py              # FastAPI app, routes
│   ├── pipeline.py           # 4-stage orchestrator
│   ├── collectors.py         # CrUX, PSI, HTTP fetch
│   ├── extractor.py          # HTML parsing, signal extraction
│   ├── llm.py                # OpenRouter client, two-tier dispatch
│   ├── cost_tracker.py       # Token/cost logging middleware
│   ├── prompts.py            # System prompts for Tier 1 + Tier 2
│   ├── models.py             # Pydantic schemas (report, settings, etc.)
│   ├── config.py             # Env vars, model pricing dict
│   ├── db.py                 # SQLite for history + cost tracking
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── URLInput.jsx
│   │   │   ├── ProgressBar.jsx
│   │   │   ├── ReportView.jsx
│   │   │   ├── MetricCard.jsx
│   │   │   ├── IssueTable.jsx
│   │   │   ├── ThirdPartyTable.jsx
│   │   │   ├── PriorityTable.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── CostTracker.jsx
│   │   └── lib/
│   │       └── api.js        # fetch wrappers
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .env                      # OPENROUTER_API_KEY, GOOGLE_API_KEY
└── README.md
```

---

## Key Implementation Notes

1. **Prompt engineering is critical.** The Tier 2 prompt must produce strict JSON matching the report schema. Include the full JSON schema in the system prompt + one complete example output. Use `response_format: { type: "json_object" }` if the model supports it via OpenRouter.

2. **HTML head extraction.** Don't send the entire 1.4 MB HTML to the LLM. Send only: the full `<head>` section + a structured summary (the extracted signals from Stage 2). This keeps Tier 2 input under 15-20K tokens.

3. **Third-party classification.** Build a hardcoded lookup of ~50 known third-party domains with categories (GTM → tag_manager, VWO → ab_testing, etc.). Unknown domains default to "unknown" and the LLM classifies them.

4. **Async pipeline.** Use Python `asyncio` or background tasks (FastAPI BackgroundTasks). The frontend polls `/api/status` every 2 seconds. Don't use WebSockets — polling is simpler and sufficient for a 30-60 second pipeline.

5. **SQLite is fine.** Single-user tool. Store analyses and cost logs in SQLite. No need for Postgres.

6. **Error handling.** Each pipeline stage can fail independently. If CrUX returns empty, continue. If PSI fails, continue with HTML-only analysis. If LLM returns malformed JSON, retry once with a "fix this JSON" follow-up. Surface errors in the report as warnings, not hard failures.

7. **Model pricing config.** Hardcode a dict of model → price_per_million_input/output. Update manually when prices change. OpenRouter's model list endpoint can supplement this but don't depend on it.

8. **CORS.** Add FastAPI CORSMiddleware allowing `localhost:5173` (Vite dev) and the production frontend origin.

9. **API keys in UI.** The settings panel exposes keys over HTTP. Acceptable for a self-hosted/localhost tool. If deployed publicly, gate the settings endpoint behind a simple password or disable key editing in the UI (read from .env only).

10. **LLM JSON fallback chain.** If Tier 2 returns malformed JSON: (a) retry once with "Fix this JSON to match the schema" + the broken output. (b) If retry fails, return a partial report with whatever Stage 1-2 data we have, plus an error banner in the UI: "LLM analysis failed — showing raw metrics only."

---

## Appendix A: Tier 2 Prompt Specification

The intelligence model prompt must produce the exact JSON schema above. Here is the prompt structure:

```
SYSTEM:
You are a Core Web Vitals performance engineer. You analyze websites and produce
structured root-cause reports.

You will receive:
1. CrUX field metrics (real user data, p75 values)
2. PSI audit summary (lab diagnostics, condensed)
3. Source signals (DOM stats, script inventory, CSS/font/image analysis, third-party list)
4. The raw <head> section of the HTML

Your task: Identify every root cause of poor INP, LCP, and CLS on this page.
For each issue, provide: name, type (first_party/third_party), description, fix,
quantitative impact_metric, severity (critical/high/medium/low), difficulty (easy/moderate/hard).

Then produce:
- A third-party impact matrix rating each external script's impact on all three CWVs.
- A priority table sorting ALL fixes across all metrics by: severity desc, then difficulty asc.

INP gets the deepest analysis. For INP, you must analyze:
- DOM size impact on style recalculation per interaction
- Event handler complexity (jQuery delegation, Bootstrap collapse, accordion patterns)
- Main-thread contention from third-party scripts during interaction windows
- Render-blocking scripts that queue early user inputs

Respond with ONLY valid JSON matching this exact schema (no markdown, no backticks,
no explanation outside the JSON):

{schema inserted here — the full report schema from the PRD}

Here is one complete example of a correct response for a different website:

{example output inserted here — a full JSON object with 3-4 issues per metric,
a 5-row third-party matrix, and a 10-row priority table}
```

**Critical:** The example output must be a complete, realistic JSON object — not abbreviated. Claude Code should generate this example by running the tool once manually against a test URL and capturing the output, then hardcoding it.

---

## Appendix B: Example Report Output (abbreviated for PRD, full version in prompts.py)

```json
{
  "url": "https://example.com/page",
  "device": "mobile",
  "timestamp": "2025-02-18T10:00:00Z",
  "field_metrics": {
    "lcp": { "p75": 4200, "rating": "poor" },
    "inp": { "p75": 680, "rating": "poor" },
    "cls": { "p75": 0.18, "rating": "needs_improvement" }
  },
  "lab_metrics": {
    "performance_score": 32,
    "lcp": 5800,
    "tbt": 2400,
    "cls": 0.22,
    "fcp": 3200,
    "si": 6100
  },
  "source_stats": {
    "dom_nodes": 9100,
    "html_size_kb": 1420,
    "total_scripts": 48,
    "render_blocking_scripts": 3,
    "stylesheets": 13,
    "total_images": 256,
    "images_without_dimensions": 187,
    "third_party_domains": 10
  },
  "inp_analysis": {
    "issues": [
      {
        "name": "Massive DOM (9,100 nodes)",
        "type": "first_party",
        "description": "DOM is 6.5x Google's 1,400-node recommendation. Every interaction forces style recalculation across the full tree. Mega-navigation is duplicated for desktop and mobile, both always in DOM.",
        "fix": "Lazy-render sub-menus on hover/tap. Remove duplicate mobile nav. Target under 1,500 nodes.",
        "impact_metric": "9,100 → 1,500 nodes. Style recalc per interaction: ~80-200ms → ~10-30ms.",
        "severity": "critical",
        "difficulty": "hard"
      },
      {
        "name": "Google Maps API loaded 8x",
        "type": "first_party",
        "description": "Each Branch Locator section includes its own Maps script tag. 8 full API loads means 8x parsing, compilation, and initialization on main thread.",
        "fix": "Load Maps API once. Lazy-load on first Find Branch click.",
        "impact_metric": "8 → 1 API loads. Saves ~500-800 KB JS parse time.",
        "severity": "critical",
        "difficulty": "easy"
      }
    ]
  },
  "lcp_analysis": {
    "issues": [
      {
        "name": "13 render-blocking CSS files",
        "type": "first_party",
        "description": "13 CSS files in <head>, all render-blocking. Browser cannot paint the LCP element until all are downloaded and parsed.",
        "fix": "Inline critical CSS for above-fold content (~15 KB). Load rest with media=print onload pattern. Concatenate to 1-2 bundles.",
        "impact_metric": "13 blocking CSS → 1 inline + 2 deferred. ~500-1500ms LCP reduction on 3G.",
        "severity": "critical",
        "difficulty": "moderate"
      }
    ]
  },
  "cls_analysis": {
    "issues": [
      {
        "name": "187 images missing width/height",
        "type": "first_party",
        "description": "73% of images have no explicit dimensions. Browser cannot reserve space, causing content jumps on load.",
        "fix": "Add width and height attributes to all img tags. Use CSS aspect-ratio for responsive sizing.",
        "impact_metric": "187 → 0 images without dims. Potential CLS reduction: ~0.15-0.30.",
        "severity": "critical",
        "difficulty": "moderate"
      }
    ]
  },
  "third_party_matrix": [
    {
      "script_name": "VWO",
      "domain": "dev.visualwebsiteoptimizer.com",
      "category": "A/B Testing",
      "loading": "sync, head",
      "lcp_impact": "critical",
      "cls_impact": "critical",
      "inp_impact": "high",
      "recommendation": "remove",
      "fix": "Remove from claims page or reduce tolerance to 300ms, hide specific element instead of body."
    }
  ],
  "priority_table": [
    {
      "rank": 1,
      "fix": "Remove VWO body-hide from claims page",
      "affects": ["LCP", "CLS", "INP"],
      "severity": "critical",
      "difficulty": "easy",
      "estimated_improvement": "LCP: -1-2s, CLS: -0.1-0.2, INP: -100-200ms"
    },
    {
      "rank": 2,
      "fix": "Consolidate Google Maps to single lazy-loaded instance",
      "affects": ["INP", "LCP"],
      "severity": "critical",
      "difficulty": "easy",
      "estimated_improvement": "INP: -200-400ms, saves ~600KB JS"
    }
  ]
}
```

---

## Appendix C: Independent Review Notes

Reviewed by an independent agent given only the goal: "Build a tool that analyzes a URL's CWV, identifies root causes of poor INP/LCP/CLS, generates an interactive report with prioritized fixes."

| #   | Gap                                                                   | Status                                                   |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Tier 2 prompt underspecified — Claude Code won't know how to write it | **Fixed** — Appendix A added with full prompt structure  |
| 2   | No fallback if Tier 2 JSON retry also fails                           | **Fixed** — Note 10 added: partial report + error banner |
| 3   | LCP/CLS schema was `"same structure"` — ambiguous for implementation  | **Fixed** — Full schema repeated for all three metrics   |
| 4   | No CORS config mentioned for dev                                      | **Fixed** — Note 8 added                                 |
| 5   | API keys editable via UI over HTTP — security note needed             | **Fixed** — Note 9 added                                 |
| 6   | No example output for the Tier 2 prompt                               | **Fixed** — Appendix B added                             |

**Remaining risks (acceptable for v1):**

- The extractor (Stage 2) signal list is ambitious. Some patterns (accordion count, carousel detection) may need iterative regex tuning per-site. Start with the basics (DOM stats, scripts, images, fonts, 3P domains) and add pattern detectors incrementally.
- Priority table sorting (severity desc → difficulty asc) assumes the LLM will rank correctly. Validate the first 5 runs manually and adjust the prompt if ranking quality is off.
- CrUX URL-level data availability is unpredictable. The fallback to origin-level is correct but the UI should clearly indicate when field data is origin-level vs URL-level.
