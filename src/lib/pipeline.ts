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
import { detectNetworkStack } from "./network-stack";
import { analyzeTopScripts } from "./js-analyzer";
import type { NetworkStackInfo, JSAnalysisResult } from "./types";
import {
  buildExtractionPrompt,
  buildTier2Prompt,
  detectTechStack,
  findDuplicateResources,
  DEFAULT_EXTRACTION_SYSTEM_PROMPT,
  DEFAULT_TIER2_SYSTEM_PROMPT,
} from "./prompts";
import { saveAnalysis } from "./db";
import {
  updateStage,
  setDetail,
  setError,
  setComplete,
  setInMemoryReport,
  getAbortSignal,
  cancelPipeline,
  updateCollectionProgress,
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
    fcp: z.object({ p75: z.number(), rating: ratingEnum }).nullable(),
  }),
  lab_metrics: z.object({
    performance_score: z.number(),
    lcp: z.number(),
    tbt: z.number(),
    cls: z.number(),
    fcp: z.number(),
    si: z.number(),
  }),
  fcp_analysis: z.object({ issues: z.array(issueSchema) }),
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
  techStack?: string[];
}

const PIPELINE_TOTAL_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes max

class PipelineTimeoutError extends Error {
  constructor() {
    super("Pipeline exceeded maximum time limit (8 minutes)");
    this.name = "PipelineTimeoutError";
  }
}

export async function runPipeline(
  analysisId: string,
  url: string,
  options?: PipelineOptions,
): Promise<void> {
  const psiOnly = options?.psiOnly ?? false;
  const warnings: string[] = [];
  const pipelineStart = Date.now();

  // Hard timeout: abort all in-flight requests after 8 minutes
  const pipelineTimeout = setTimeout(() => {
    console.warn(`[pipeline] Hard timeout reached for ${analysisId}, aborting`);
    cancelPipeline(analysisId);
  }, PIPELINE_TOTAL_TIMEOUT_MS);

  /** Throw if pipeline has exceeded total time budget */
  const checkPipelineTimeout = () => {
    if (Date.now() - pipelineStart > PIPELINE_TOTAL_TIMEOUT_MS) {
      throw new PipelineTimeoutError();
    }
  };

  try {
    // ===== STAGE 1: Data Collection + Extraction (all in parallel) =====
    checkAbort(analysisId);
    checkPipelineTimeout();

    const psiApiKey = getGoogleApiKey();
    if (!psiApiKey) {
      throw new Error("GOOGLE_PSI_API_KEY not set. Add it to your .env file.");
    }

    const extractionModel =
      getSetting("extraction_model") ?? DEFAULT_EXTRACTION_MODEL;
    const customExtractionPrompt =
      getSetting("extraction_system_prompt") ?? undefined;

    // HTML fetch + extraction with per-step tracking
    updateCollectionProgress(analysisId, {
      html_fetch: "running",
      html_fetch_start: new Date().toISOString(),
    });
    const htmlAndExtractionPromise = (async () => {
      let html;
      try {
        html = await fetchHTML(url);
        updateCollectionProgress(analysisId, {
          html_fetch: "done",
          html_fetch_end: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("[pipeline] HTML fetch failed:", err);
        updateCollectionProgress(analysisId, {
          html_fetch: "failed",
          html_fetch_end: new Date().toISOString(),
        });
        return null;
      }
      try {
        updateCollectionProgress(analysisId, {
          html_extract: "running",
          html_extract_start: new Date().toISOString(),
        });
        const { system, user } = buildExtractionPrompt(
          html.head,
          html.fullHtml,
          customExtractionPrompt,
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
        updateCollectionProgress(analysisId, {
          html_extract: "done",
          html_extract_end: new Date().toISOString(),
        });
        return {
          html,
          extracted: result.data,
          networkStack: detectNetworkStack(html.responseHeaders),
        };
      } catch (err) {
        console.warn("[pipeline] HTML extraction failed:", err);
        updateCollectionProgress(analysisId, {
          html_extract: "failed",
          html_extract_end: new Date().toISOString(),
        });
        // Still return network stack even if extraction fails
        return {
          html,
          extracted: null,
          networkStack: detectNetworkStack(html.responseHeaders),
        };
      }
    })();

    const psiRetryHandler = (device: string) => ({
      onRetry: (attempt: number, max: number, reason: string) => {
        const short = /NO_FCP|NO_LCP/.test(reason)
          ? "page render failed"
          : /timeout|abort/i.test(reason)
            ? "timed out"
            : "error";
        updateCollectionProgress(analysisId, {
          psi_detail: `Retrying ${device} (${attempt}/${max}) — ${short}`,
        });
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
        updateCollectionProgress(analysisId, {
          psi_detail: "Waiting 15s before retry...",
          psi_desktop: "pending",
          psi_mobile: "pending",
        });
        await new Promise((resolve) =>
          setTimeout(resolve, PIPELINE_COOLDOWN_MS),
        );
        checkAbort(analysisId);
        updateCollectionProgress(analysisId, {
          psi_detail: `Retrying (attempt ${pipelineAttempt + 1}/3)...`,
        });
      }

      // Track desktop start
      updateCollectionProgress(analysisId, {
        psi_desktop: "running",
        psi_desktop_start: new Date().toISOString(),
        psi_detail: "Waiting for Google PSI response...",
      });

      // Heartbeat: update psi_detail every 10s so users know it's alive
      const heartbeatStart = Date.now();
      const heartbeat = setInterval(() => {
        const elapsed = Math.round((Date.now() - heartbeatStart) / 1000);
        updateCollectionProgress(analysisId, {
          psi_detail: `Google is analyzing the page... ${elapsed}s (attempt ${pipelineAttempt + 1}/${PIPELINE_PSI_RETRIES + 1}, large sites can take up to 3 min)`,
        });
      }, 10_000);

      const delayedMobile = new Promise<PSIResult>((resolve, reject) => {
        setTimeout(() => {
          updateCollectionProgress(analysisId, {
            psi_mobile: "running",
            psi_mobile_start: new Date().toISOString(),
          });
          fetchPSI(url, "mobile", psiApiKey, psiRetryHandler("mobile"))
            .then((result) => {
              updateCollectionProgress(analysisId, {
                psi_mobile: "done",
                psi_mobile_end: new Date().toISOString(),
              });
              resolve(result);
            })
            .catch((err) => {
              updateCollectionProgress(analysisId, {
                psi_mobile: "failed",
                psi_mobile_end: new Date().toISOString(),
              });
              reject(err);
            });
        }, PSI_STAGGER_MS);
      });

      const trackedDesktop = fetchPSI(
        url,
        "desktop",
        psiApiKey,
        psiRetryHandler("desktop"),
      )
        .then((result) => {
          updateCollectionProgress(analysisId, {
            psi_desktop: "done",
            psi_desktop_end: new Date().toISOString(),
          });
          return result;
        })
        .catch((err) => {
          updateCollectionProgress(analysisId, {
            psi_desktop: "failed",
            psi_desktop_end: new Date().toISOString(),
          });
          throw err;
        });

      const [desktopResult, mobileResult] = await Promise.allSettled([
        trackedDesktop,
        delayedMobile,
      ]);

      clearInterval(heartbeat);
      updateCollectionProgress(analysisId, { psi_detail: undefined });

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
        updateCollectionProgress(analysisId, {
          psi_mobile: "running",
          psi_mobile_start: new Date().toISOString(),
          psi_detail: "Retrying mobile...",
        });
        try {
          mobilePsi = await fetchPSI(
            url,
            "mobile",
            psiApiKey,
            psiRetryHandler("mobile"),
          );
          updateCollectionProgress(analysisId, {
            psi_mobile: "done",
            psi_mobile_end: new Date().toISOString(),
          });
        } catch (err) {
          console.warn("[pipeline] Mobile PSI sequential retry failed:", err);
          updateCollectionProgress(analysisId, {
            psi_mobile: "failed",
            psi_mobile_end: new Date().toISOString(),
          });
        }
        updateCollectionProgress(analysisId, { psi_detail: undefined });
      } else if (!desktopPsi && mobilePsi) {
        checkAbort(analysisId);
        updateCollectionProgress(analysisId, {
          psi_desktop: "running",
          psi_desktop_start: new Date().toISOString(),
          psi_detail: "Retrying desktop...",
        });
        try {
          desktopPsi = await fetchPSI(
            url,
            "desktop",
            psiApiKey,
            psiRetryHandler("desktop"),
          );
          updateCollectionProgress(analysisId, {
            psi_desktop: "done",
            psi_desktop_end: new Date().toISOString(),
          });
        } catch (err) {
          console.warn("[pipeline] Desktop PSI sequential retry failed:", err);
          updateCollectionProgress(analysisId, {
            psi_desktop: "failed",
            psi_desktop_end: new Date().toISOString(),
          });
        }
        updateCollectionProgress(analysisId, { psi_detail: undefined });
      }

      // At least one device succeeded → continue pipeline
      if (mobilePsi || desktopPsi) break;
    }

    // Await HTML extraction (started in parallel, should be done by now)
    const htmlExtraction = await htmlAndExtractionPromise;

    if (!mobilePsi && !desktopPsi) {
      const friendly = friendlyPsiError(lastPsiError);

      // Graceful fallback: if HTML extraction succeeded, produce partial report
      if (htmlExtraction) {
        warnings.push(
          `PSI analysis failed for both devices — ${friendly} Showing HTML-based signals only.`,
        );

        const fallbackSignals: ExtractedSignals | null =
          (htmlExtraction.extracted as ExtractedSignals | null) ?? null;
        const fallbackNetworkStack: NetworkStackInfo | undefined =
          htmlExtraction.networkStack ?? undefined;
        const fallbackSourceStats = fallbackSignals
          ? extractedSignalsToSourceStats(fallbackSignals)
          : EMPTY_SOURCE_STATS;
        const fallbackTechStack = Array.from(
          new Set([
            ...(options?.techStack ?? []),
            ...detectTechStack(fallbackSignals, undefined),
          ]),
        );

        const partialReport: AnalysisReport = {
          id: analysisId,
          url,
          timestamp: new Date().toISOString(),
          source_stats: fallbackSourceStats,
          mobile: null,
          desktop: null,
          warnings,
          tech_stack:
            fallbackTechStack.length > 0 ? fallbackTechStack : undefined,
          network_stack: fallbackNetworkStack,
          source_stats_source: fallbackSignals
            ? "html_extraction"
            : "psi_fallback",
        };

        try {
          saveAnalysis(partialReport);
        } catch (err) {
          console.warn("[pipeline] Failed to save partial report:", err);
        }
        setComplete(analysisId);
        return;
      }

      throw new Error(
        `Could not analyze this page. ${friendly} Please try again.`,
      );
    }

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
    setDetail(analysisId, "Processing HTML signals and PSI data...");

    // ===== STAGE 2: Signal Processing (results already available from Stage 1) =====
    checkAbort(analysisId);
    checkPipelineTimeout();

    const fetchedHtml = htmlExtraction?.html ?? null;
    const extractedSignals: ExtractedSignals | null =
      (htmlExtraction?.extracted as ExtractedSignals | null) ?? null;
    const networkStack: NetworkStackInfo | undefined =
      htmlExtraction?.networkStack ?? undefined;
    let sourceStats: SourceStats = EMPTY_SOURCE_STATS;

    let sourceStatsSource: "html_extraction" | "psi_fallback" = "psi_fallback";
    if (extractedSignals) {
      sourceStats = extractedSignalsToSourceStats(extractedSignals);
      sourceStatsSource = "html_extraction";
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
        source_stats_source: sourceStatsSource,
      };

      setInMemoryReport(analysisId, report);
      setComplete(analysisId);
      return;
    }

    updateStage(analysisId, 3, "Analyzing", 40);
    setDetail(
      analysisId,
      "Running deep AI analysis (this may take 1-2 min)...",
    );

    // ===== STAGE 3: Deep Analysis (Opus, parallel mobile + desktop) =====
    checkAbort(analysisId);
    checkPipelineTimeout();

    const intelligenceModel =
      getSetting("intelligence_model") ?? DEFAULT_INTELLIGENCE_MODEL;
    const customTier2Prompt = getSetting("tier2_system_prompt") ?? undefined;
    const headHtml = fetchedHtml?.head ?? "";

    // Pre-compute tech stack and duplicates (shared across devices and report)
    const primaryPsi = mobilePsi ?? desktopPsi;
    const autoDetectedStack = detectTechStack(
      extractedSignals,
      primaryPsi?.networkRequests,
    );
    const userStack = options?.techStack ?? [];
    const finalTechStack = Array.from(
      new Set([...userStack, ...autoDetectedStack]),
    );
    const duplicateResources = findDuplicateResources(
      primaryPsi?.networkRequests,
    );

    // Extract INP script summary from bootup-time diagnostic
    const extractScriptSummary = (psiResult: PSIResult) => {
      const bootupItems =
        psiResult.diagnostics.find((d) => d.id === "bootup-time")?.items ?? [];
      return bootupItems
        .filter((item) => item.url)
        .slice(0, 10)
        .map((item) => ({
          url: item.url!,
          totalBytes: item.totalBytes ?? 0,
          mainThreadTime: item.wastedMs,
        }));
    };

    const analyzeDevice = async (
      psiResult: PSIResult,
      device: "mobile" | "desktop",
    ): Promise<DeviceReport> => {
      // Extract script summary for INP analysis
      const scriptSummary = extractScriptSummary(psiResult);

      // Start JS file analysis in parallel with LLM call
      const jsAnalysisPromise =
        scriptSummary.length > 0
          ? analyzeTopScripts(scriptSummary, getAbortSignal(analysisId)).catch(
              (err) => {
                console.warn("[pipeline] JS analysis failed:", err);
                return [] as JSAnalysisResult[];
              },
            )
          : Promise.resolve([] as JSAnalysisResult[]);

      const { system, user } = buildTier2Prompt(
        psiResult,
        extractedSignals,
        headHtml,
        device,
        customTier2Prompt,
        { techStack: finalTechStack, duplicates: duplicateResources },
      );

      // Run LLM call and JS analysis in parallel
      const [result, jsAnalysis] = await Promise.all([
        callOpenRouter({
          model: intelligenceModel,
          systemPrompt: system,
          userPrompt: user,
          schema: deviceReportSchema,
          analysisId,
          tier: "intelligence",
          signal: getAbortSignal(analysisId),
        }),
        jsAnalysisPromise,
      ]);

      const data: DeviceReport = result.data as DeviceReport;

      // Safety net: patch performance_score if LLM returned 0 but PSI has a real score
      if (
        data.lab_metrics.performance_score === 0 &&
        psiResult.overallScore > 0
      ) {
        data.lab_metrics.performance_score = Math.round(psiResult.overallScore);
      }

      // Attach INP script summary from PSI bootup-time data
      if (scriptSummary.length > 0) {
        data.inp_script_summary = scriptSummary;
      }

      // Attach JS analysis results
      if (jsAnalysis.length > 0) {
        data.js_analysis = jsAnalysis;
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
    setDetail(analysisId, "Building report...");

    // ===== STAGE 4: Report Assembly =====
    checkAbort(analysisId);
    checkPipelineTimeout();

    const report: AnalysisReport = {
      id: analysisId,
      url,
      timestamp: new Date().toISOString(),
      source_stats: sourceStats,
      mobile: mobileReport,
      desktop: desktopReport,
      warnings,
      tech_stack: finalTechStack.length > 0 ? finalTechStack : undefined,
      duplicate_resources:
        duplicateResources.length > 0 ? duplicateResources : undefined,
      network_stack: networkStack,
      source_stats_source: sourceStatsSource,
    };

    // Write to SQLite FIRST, then update progress (prevents race condition)
    try {
      saveAnalysis(report);
    } catch (err) {
      console.warn("[pipeline] Failed to save to SQLite:", err);
      warnings.push("Report saved in memory only — database write failed");
    }

    clearTimeout(pipelineTimeout);
    setComplete(analysisId);
  } catch (err) {
    clearTimeout(pipelineTimeout);

    // Detect hard timeout abort (cancelPipeline triggers AbortError)
    const isTimeout =
      err instanceof PipelineTimeoutError ||
      (err instanceof Error &&
        /abort|cancel/i.test(err.message) &&
        Date.now() - pipelineStart >= PIPELINE_TOTAL_TIMEOUT_MS - 5000);

    if (isTimeout) {
      const elapsed = Math.round((Date.now() - pipelineStart) / 1000);
      console.error(`[pipeline] Timed out after ${elapsed}s for ${url}`);
      setError(
        analysisId,
        `Analysis timed out after ${elapsed} seconds. This site may be too complex or slow. Please try again — subsequent attempts are often faster as Google caches intermediate results.`,
      );
      return;
    }
    const message =
      err instanceof Error ? err.message : "Unknown pipeline error";
    console.error("[pipeline] Error:", message);
    setError(analysisId, message);
  }
}
