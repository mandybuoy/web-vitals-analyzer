// 4-stage pipeline orchestrator
// Stage 1: Data Collection (PSI + HTML fetch + extraction in parallel)
// Stage 2: Signal Processing (extract source stats from Stage 1 results)
// Stage 3: Deep Analysis (Opus via OpenRouter, mobile + desktop in parallel)
// Stage 4: Report Assembly + SQLite persistence

import { z } from "zod";
import { fetchPSI } from "./psi";
import type {
  PSIResult,
  ExtractedSignals,
  DeviceReport,
  AnalysisReport,
  SourceStats,
} from "./types";
import {
  extractedSignalsToSourceStats,
  psiRatingToVitalRating,
  cruxCategoryToVitalRating,
} from "./types";
import { getGoogleApiKey } from "./config";
import { getSetting } from "./db";
import { DEFAULT_EXTRACTION_MODEL, DEFAULT_INTELLIGENCE_MODEL } from "./config";
import { fetchHTML } from "./html-fetcher";
import { callOpenRouter } from "./openrouter";
import { buildExtractionPrompt, buildTier2Prompt } from "./prompts";
import { saveAnalysis } from "./db";
import {
  updateStage,
  setDetail,
  setError,
  setComplete,
  setInMemoryReport,
  getAbortSignal,
} from "./pipeline-store";

// ----- Zod Schemas -----

const extractedSignalsSchema = z.object({
  dom_stats: z.object({
    html_size_bytes: z.number(),
    estimated_dom_nodes: z.number(),
    anchor_count: z.number(),
    form_element_count: z.number(),
    img_total: z.number(),
    img_without_dimensions: z.number(),
    img_lazy_loaded: z.number(),
    picture_elements: z.number(),
  }),
  scripts: z.object({
    total: z.number(),
    render_blocking: z.array(
      z.object({ src: z.string(), position: z.string() }),
    ),
    async_scripts: z.array(z.object({ src: z.string() })),
    defer_scripts: z.array(z.object({ src: z.string() })),
    inline_script_count: z.number(),
    inline_script_size_bytes: z.number(),
  }),
  css: z.object({
    stylesheet_count: z.number(),
    inline_style_blocks: z.number(),
    has_critical_css_inlined: z.boolean(),
  }),
  fonts: z.object({
    preloaded: z.array(z.string()),
    font_display_values: z.record(z.string(), z.number()),
  }),
  third_party: z.object({
    domains: z.array(z.string()),
    scripts: z.array(
      z.object({
        src: z.string(),
        position: z.string(),
        loading: z.string(),
        category: z.string(),
      }),
    ),
  }),
  patterns: z.object({
    fetchpriority_high_on_content: z.boolean(),
    image_formats: z.record(z.string(), z.number()),
    preconnect_hints: z.array(z.string()),
    preload_hints_non_font: z.array(z.string()),
  }),
  lcp_candidates: z.object({
    hero_image_src: z.string().nullable(),
    hero_image_preloaded: z.boolean(),
    h1_text: z.string().nullable(),
  }),
});

const severityEnum = z.enum(["critical", "high", "medium", "low"]);
const difficultyEnum = z.enum(["easy", "moderate", "hard"]);
const ratingEnum = z.enum(["good", "needs_improvement", "poor"]);
const evidenceBasisEnum = z.enum(["measured", "inferred", "best_practice"]);

const issueSchema = z.object({
  name: z.string(),
  type: z.enum(["first_party", "third_party"]),
  description: z.string(),
  fix: z.string(),
  code_example: z.string().nullable().optional(),
  impact_metric: z.string(),
  severity: severityEnum,
  difficulty: difficultyEnum,
  is_generic_example: z.boolean().optional(),
  is_observation: z.boolean().optional(),
  trade_off: z.string().nullable().optional(),
  evidence_basis: evidenceBasisEnum.optional(),
});

const deviceReportSchema = z.object({
  device: z.enum(["mobile", "desktop"]),
  field_metrics: z.object({
    lcp: z.object({ p75: z.number(), rating: ratingEnum }).nullable(),
    inp: z.object({ p75: z.number(), rating: ratingEnum }).nullable(),
    cls: z.object({ p75: z.number(), rating: ratingEnum }).nullable(),
  }),
  lab_metrics: z.object({
    performance_score: z.number(),
    lcp: z.number(),
    tbt: z.number(),
    cls: z.number(),
    fcp: z.number(),
    si: z.number(),
  }),
  inp_analysis: z.object({ issues: z.array(issueSchema) }),
  lcp_analysis: z.object({ issues: z.array(issueSchema) }),
  cls_analysis: z.object({ issues: z.array(issueSchema) }),
  third_party_matrix: z.array(
    z.object({
      script_name: z.string(),
      domain: z.string(),
      category: z.string(),
      loading: z.string(),
      lcp_impact: severityEnum,
      cls_impact: severityEnum,
      inp_impact: severityEnum,
      recommendation: z.enum(["remove", "defer", "lazy_load", "keep"]),
      fix: z.string(),
      code_example: z.string().nullable().optional(),
      trade_off: z.string().nullable().optional(),
    }),
  ),
  priority_table: z.array(
    z.object({
      rank: z.number(),
      fix: z.string(),
      affects: z.array(z.enum(["INP", "LCP", "CLS"])),
      severity: severityEnum,
      difficulty: difficultyEnum,
      estimated_improvement: z.string(),
      evidence_basis: evidenceBasisEnum.optional(),
    }),
  ),
});

// ----- Friendly error messages -----

function friendlyPsiError(raw: string): string {
  if (/NO_FCP|NO_LCP/.test(raw))
    return "The page took too long to render content. This is a known issue with heavy single-page apps.";
  if (/FAILED_DOCUMENT_REQUEST|ERRORED_DOCUMENT_REQUEST/.test(raw))
    return "Google could not load this page. The site may be blocking automated requests.";
  if (/timeout|timed out|aborted/i.test(raw))
    return "The request timed out. The site may be too slow or temporarily unavailable.";
  if (/429/.test(raw))
    return "Google rate-limited our requests. Please try again in a minute.";
  if (/5\d{2}/.test(raw))
    return "Google's analysis service had a temporary error. Please try again.";
  return "Google PageSpeed analysis could not complete for this page.";
}

// ----- Check abort -----

function checkAbort(analysisId: string): void {
  const signal = getAbortSignal(analysisId);
  if (signal?.aborted) {
    throw new Error("Analysis cancelled");
  }
}

// ----- Default empty SourceStats -----

const EMPTY_SOURCE_STATS: SourceStats = {
  dom_nodes: 0,
  html_size_kb: 0,
  total_scripts: 0,
  render_blocking_scripts: 0,
  stylesheets: 0,
  total_images: 0,
  images_without_dimensions: 0,
  third_party_domains: 0,
};

// Extract partial source stats from PSI diagnostics when HTML fetch fails
function extractFallbackSourceStats(psi: PSIResult): SourceStats {
  const stats = { ...EMPTY_SOURCE_STATS };

  try {
    // DOM nodes from dom-size diagnostic (displayValue: "1,483 elements")
    const domSize = psi.diagnostics.find((d) => d.id === "dom-size");
    if (domSize?.displayValue) {
      const match = domSize.displayValue.match(/([\d,]+)\s*element/);
      if (match) stats.dom_nodes = parseInt(match[1].replace(/,/g, ""), 10);
    }

    // Render-blocking resources count
    const blocking = psi.opportunities.find(
      (o) => o.id === "render-blocking-resources",
    );
    if (blocking?.displayValue) {
      // displayValue is like "Potential savings of 1,230 ms"
      // The existence of this opportunity means there are blocking resources
      // We can't get exact count from displayValue, but we know there's at least 1
      stats.render_blocking_scripts = 1;
    }

    // Third-party domains from third-party-summary diagnostic
    const thirdParty = psi.diagnostics.find(
      (d) => d.id === "third-party-summary",
    );
    if (thirdParty?.displayValue) {
      // displayValue: "Third-party code blocked the main thread for 850 ms"
      // We can't parse domain count, but if the diagnostic exists, there are 3P scripts
      stats.third_party_domains = 1; // at least 1
    }
  } catch {
    // Fallback parsing is best-effort
  }

  return stats;
}

// ----- Pipeline Entry Point -----

export interface PipelineOptions {
  psiOnly?: boolean;
}

export async function runPipeline(
  analysisId: string,
  url: string,
  options?: PipelineOptions,
): Promise<void> {
  const psiOnly = options?.psiOnly ?? false;
  const warnings: string[] = [];

  try {
    // ===== STAGE 1: Data Collection + Extraction (all in parallel) =====
    checkAbort(analysisId);

    const psiApiKey = getGoogleApiKey();
    if (!psiApiKey) {
      throw new Error("GOOGLE_PSI_API_KEY not set. Add it to your .env file.");
    }

    const extractionModel =
      getSetting("extraction_model") ?? DEFAULT_EXTRACTION_MODEL;

    // Chain extraction off HTML fetch — starts as soon as HTML arrives,
    // overlapping with PSI fetches that are typically slower
    const htmlAndExtractionPromise = fetchHTML(url)
      .then(async (html) => {
        const { system, user } = buildExtractionPrompt(
          html.head,
          html.fullHtml,
        );
        const result = await callOpenRouter({
          model: extractionModel,
          systemPrompt: system,
          userPrompt: user,
          schema: extractedSignalsSchema,
          analysisId,
          tier: "extraction",
          signal: getAbortSignal(analysisId),
        });
        return { html, extracted: result.data };
      })
      .catch((err) => {
        console.warn("[pipeline] HTML fetch/extraction failed:", err);
        return null;
      });

    const psiRetryHandler = (device: string) => ({
      onRetry: (attempt: number, max: number, reason: string) => {
        const short = /NO_FCP|NO_LCP/.test(reason)
          ? "page render failed"
          : /timeout|abort/i.test(reason)
            ? "timed out"
            : "error";
        setDetail(
          analysisId,
          `Retrying ${device} PSI (${attempt}/${max}) — ${short}`,
        );
      },
    });

    // --- Pipeline-level PSI retry ---
    // Heavy SPAs (e.g. piramalfinance.com) can fail with NO_FCP persistently.
    // A cooldown lets Google rotate Lighthouse instances, improving success.
    const PSI_STAGGER_MS = 5_000;
    const PIPELINE_PSI_RETRIES = 2; // up to 3 total attempts
    const PIPELINE_COOLDOWN_MS = 15_000;

    let mobilePsi: PSIResult | null = null;
    let desktopPsi: PSIResult | null = null;
    let lastPsiError = "";

    for (
      let pipelineAttempt = 0;
      pipelineAttempt <= PIPELINE_PSI_RETRIES;
      pipelineAttempt++
    ) {
      checkAbort(analysisId);

      if (pipelineAttempt > 0) {
        console.log(
          `[pipeline] Both PSI failed, cooling down ${PIPELINE_COOLDOWN_MS / 1000}s before attempt ${pipelineAttempt + 1}/3...`,
        );
        setDetail(analysisId, "Waiting 15s before retry...");
        await new Promise((resolve) =>
          setTimeout(resolve, PIPELINE_COOLDOWN_MS),
        );
        checkAbort(analysisId);
        setDetail(
          analysisId,
          `Retrying analysis (attempt ${pipelineAttempt + 1}/3)...`,
        );
      }

      const delayedMobile = new Promise<PSIResult>((resolve, reject) => {
        setTimeout(() => {
          fetchPSI(url, "mobile", psiApiKey, psiRetryHandler("mobile"))
            .then(resolve)
            .catch(reject);
        }, PSI_STAGGER_MS);
      });

      const [desktopResult, mobileResult] = await Promise.allSettled([
        fetchPSI(url, "desktop", psiApiKey, psiRetryHandler("desktop")),
        delayedMobile,
      ]);

      setDetail(analysisId, undefined);

      desktopPsi =
        desktopResult.status === "fulfilled" ? desktopResult.value : null;
      mobilePsi =
        mobileResult.status === "fulfilled" ? mobileResult.value : null;

      if (!desktopPsi && desktopResult.status === "rejected") {
        lastPsiError = String(desktopResult.reason);
      }
      if (!mobilePsi && mobileResult.status === "rejected") {
        lastPsiError = String(mobileResult.reason) || lastPsiError;
      }

      // If one device failed, retry it sequentially (cache warmed by the other)
      if (!mobilePsi && desktopPsi) {
        checkAbort(analysisId);
        setDetail(analysisId, "Retrying mobile PSI...");
        try {
          mobilePsi = await fetchPSI(
            url,
            "mobile",
            psiApiKey,
            psiRetryHandler("mobile"),
          );
        } catch (err) {
          console.warn("[pipeline] Mobile PSI sequential retry failed:", err);
        }
        setDetail(analysisId, undefined);
      } else if (!desktopPsi && mobilePsi) {
        checkAbort(analysisId);
        setDetail(analysisId, "Retrying desktop PSI...");
        try {
          desktopPsi = await fetchPSI(
            url,
            "desktop",
            psiApiKey,
            psiRetryHandler("desktop"),
          );
        } catch (err) {
          console.warn("[pipeline] Desktop PSI sequential retry failed:", err);
        }
        setDetail(analysisId, undefined);
      }

      // At least one device succeeded → continue pipeline
      if (mobilePsi || desktopPsi) break;
    }

    if (!mobilePsi && !desktopPsi) {
      const friendly = friendlyPsiError(lastPsiError);
      throw new Error(
        `Could not analyze this page. ${friendly} Please try again.`,
      );
    }

    // Await HTML extraction (started in parallel, should be done by now)
    const htmlExtraction = await htmlAndExtractionPromise;

    if (!mobilePsi) {
      warnings.push(
        `Mobile analysis unavailable — ${friendlyPsiError(lastPsiError)}`,
      );
    }
    if (!desktopPsi) {
      warnings.push(
        `Desktop analysis unavailable — ${friendlyPsiError(lastPsiError)}`,
      );
    }
    if (!htmlExtraction)
      warnings.push("HTML fetch/extraction failed — using PSI data only");

    updateStage(analysisId, 2, "Extracting", 25);

    // ===== STAGE 2: Signal Processing (results already available from Stage 1) =====
    checkAbort(analysisId);

    const fetchedHtml = htmlExtraction?.html ?? null;
    const extractedSignals: ExtractedSignals | null =
      htmlExtraction?.extracted ?? null;
    let sourceStats: SourceStats = EMPTY_SOURCE_STATS;

    if (extractedSignals) {
      sourceStats = extractedSignalsToSourceStats(extractedSignals);
    } else {
      // Fallback: extract partial source stats from PSI data
      const fallbackPsi = mobilePsi ?? desktopPsi;
      if (fallbackPsi) {
        sourceStats = extractFallbackSourceStats(fallbackPsi);
      }
    }

    // ===== PSI-ONLY: early exit after stage 2 =====
    if (psiOnly) {
      const report: AnalysisReport = {
        id: analysisId,
        url,
        timestamp: new Date().toISOString(),
        source_stats: sourceStats,
        mobile: null,
        desktop: null,
        warnings,
        psi_only: true,
        mobile_psi: mobilePsi ?? undefined,
        desktop_psi: desktopPsi ?? undefined,
      };

      setInMemoryReport(analysisId, report);
      setComplete(analysisId);
      return;
    }

    updateStage(analysisId, 3, "Analyzing", 40);

    // ===== STAGE 3: Deep Analysis (Opus, parallel mobile + desktop) =====
    checkAbort(analysisId);

    const intelligenceModel =
      getSetting("intelligence_model") ?? DEFAULT_INTELLIGENCE_MODEL;
    const headHtml = fetchedHtml?.head ?? "";

    const analyzeDevice = async (
      psiResult: PSIResult,
      device: "mobile" | "desktop",
    ): Promise<DeviceReport> => {
      const { system, user } = buildTier2Prompt(
        psiResult,
        extractedSignals,
        headHtml,
        device,
      );

      const result = await callOpenRouter({
        model: intelligenceModel,
        systemPrompt: system,
        userPrompt: user,
        schema: deviceReportSchema,
        analysisId,
        tier: "intelligence",
        signal: getAbortSignal(analysisId),
      });

      const data = result.data;

      // Safety net: patch performance_score if LLM returned 0 but PSI has a real score
      if (
        data.lab_metrics.performance_score === 0 &&
        psiResult.overallScore > 0
      ) {
        data.lab_metrics.performance_score = Math.round(psiResult.overallScore);
      }

      return data;
    };

    const analysisPromises: Promise<DeviceReport | null>[] = [];

    if (mobilePsi) {
      analysisPromises.push(
        analyzeDevice(mobilePsi, "mobile").catch((err) => {
          console.warn("[pipeline] Mobile analysis failed:", err);
          warnings.push("Mobile deep analysis failed");
          return null;
        }),
      );
    } else {
      analysisPromises.push(Promise.resolve(null));
    }

    if (desktopPsi) {
      analysisPromises.push(
        analyzeDevice(desktopPsi, "desktop").catch((err) => {
          console.warn("[pipeline] Desktop analysis failed:", err);
          warnings.push("Desktop deep analysis failed");
          return null;
        }),
      );
    } else {
      analysisPromises.push(Promise.resolve(null));
    }

    const [mobileReport, desktopReport] = await Promise.all(analysisPromises);

    updateStage(analysisId, 4, "Generating", 85);

    // ===== STAGE 4: Report Assembly =====
    checkAbort(analysisId);

    const report: AnalysisReport = {
      id: analysisId,
      url,
      timestamp: new Date().toISOString(),
      source_stats: sourceStats,
      mobile: mobileReport,
      desktop: desktopReport,
      warnings,
    };

    // Write to SQLite FIRST, then update progress (prevents race condition)
    try {
      saveAnalysis(report);
    } catch (err) {
      console.warn("[pipeline] Failed to save to SQLite:", err);
      warnings.push("Report saved in memory only — database write failed");
    }

    setComplete(analysisId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown pipeline error";
    console.error("[pipeline] Error:", message);
    setError(analysisId, message);
  }
}
