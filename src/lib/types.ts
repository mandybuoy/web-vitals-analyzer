// ===== Shared TypeScript types for VitalScan v2 =====

// ----- PSI Types (moved from psi.ts) -----

export interface PSIResult {
  strategy: "mobile" | "desktop";
  url: string;
  fetchTime: string;
  overallScore: number;
  metrics: {
    lcp: MetricData;
    inp: MetricData;
    cls: MetricData;
    fcp: MetricData;
    tbt: MetricData;
    si: MetricData;
    ttfb: MetricData;
  };
  fieldData?: FieldData;
  diagnostics: DiagnosticItem[];
  opportunities: OpportunityItem[];
  screenshots?: string[];
}

export interface FieldData {
  lcp?: FieldMetric;
  inp?: FieldMetric;
  cls?: FieldMetric;
  fcp?: FieldMetric;
  fid?: FieldMetric;
  ttfb?: FieldMetric;
}

export interface FieldMetric {
  percentile: number;
  category: "FAST" | "AVERAGE" | "SLOW";
  distributions: {
    min: number;
    max: number | null;
    proportion: number;
  }[];
}

export interface MetricData {
  name: string;
  shortName: string;
  value: number;
  displayValue: string;
  score: number; // 0-1
  rating: "good" | "needs-improvement" | "poor";
  description: string;
}

export interface DiagnosticItem {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue?: string;
}

export interface OpportunityItem {
  id: string;
  title: string;
  description: string;
  score: number | null;
  savings?: string;
  displayValue?: string;
}

// ----- Vital Ratings -----

export type VitalRating = "good" | "needs_improvement" | "poor";

// PSI uses "needs-improvement" (hyphen), our schema uses "needs_improvement" (underscore)
export function psiRatingToVitalRating(
  rating: "good" | "needs-improvement" | "poor",
): VitalRating {
  if (rating === "needs-improvement") return "needs_improvement";
  return rating;
}

// CrUX uses "FAST"/"AVERAGE"/"SLOW"
export function cruxCategoryToVitalRating(
  category: "FAST" | "AVERAGE" | "SLOW",
): VitalRating {
  switch (category) {
    case "FAST":
      return "good";
    case "AVERAGE":
      return "needs_improvement";
    case "SLOW":
      return "poor";
  }
}

// ----- Severity / Difficulty -----

export type Severity = "critical" | "high" | "medium" | "low";
export type Difficulty = "easy" | "moderate" | "hard";
export type IssueType = "first_party" | "third_party";
export type MetricName = "INP" | "LCP" | "CLS";
export type ThirdPartyAction = "remove" | "defer" | "lazy_load" | "keep";
export type EvidenceBasis = "measured" | "inferred" | "best_practice";

// ----- Issue (used in INP/LCP/CLS analysis tabs) -----

export interface Issue {
  name: string;
  type: IssueType;
  description: string;
  fix: string;
  code_example?: string | null;
  impact_metric: string;
  severity: Severity;
  difficulty: Difficulty;
  is_generic_example?: boolean;
  is_observation?: boolean;
  trade_off?: string | null;
  evidence_basis?: EvidenceBasis;
}

// ----- Third-Party Matrix Entry -----

export interface ThirdPartyEntry {
  script_name: string;
  domain: string;
  category: string;
  loading: string;
  lcp_impact: Severity;
  cls_impact: Severity;
  inp_impact: Severity;
  recommendation: ThirdPartyAction;
  fix: string;
  code_example?: string | null;
  trade_off?: string | null;
}

// ----- Priority Fix -----

export interface PriorityFix {
  rank: number;
  fix: string;
  affects: MetricName[];
  severity: Severity;
  difficulty: Difficulty;
  estimated_improvement: string;
  evidence_basis?: EvidenceBasis;
}

// ----- Source Stats (device-independent, derived from ExtractedSignals) -----

export interface SourceStats {
  dom_nodes: number;
  html_size_kb: number;
  total_scripts: number;
  render_blocking_scripts: number;
  stylesheets: number;
  total_images: number;
  images_without_dimensions: number;
  third_party_domains: number;
}

// ----- Extracted Signals (full LLM HTML extraction output) -----

export interface ExtractedSignals {
  dom_stats: {
    html_size_bytes: number;
    estimated_dom_nodes: number;
    anchor_count: number;
    form_element_count: number;
    img_total: number;
    img_without_dimensions: number;
    img_lazy_loaded: number;
    picture_elements: number;
  };
  scripts: {
    total: number;
    render_blocking: { src: string; position: string }[];
    async_scripts: { src: string }[];
    defer_scripts: { src: string }[];
    inline_script_count: number;
    inline_script_size_bytes: number;
  };
  css: {
    stylesheet_count: number;
    inline_style_blocks: number;
    has_critical_css_inlined: boolean;
  };
  fonts: {
    preloaded: string[];
    font_display_values: Record<string, number>;
  };
  third_party: {
    domains: string[];
    scripts: {
      src: string;
      position: string;
      loading: string;
      category: string;
    }[];
  };
  patterns: {
    fetchpriority_high_on_content: boolean;
    image_formats: Record<string, number>;
    preconnect_hints: string[];
    preload_hints_non_font: string[];
  };
  lcp_candidates: {
    hero_image_src: string | null;
    hero_image_preloaded: boolean;
    h1_text: string | null;
  };
}

// Derive SourceStats from ExtractedSignals
export function extractedSignalsToSourceStats(
  signals: ExtractedSignals,
): SourceStats {
  return {
    dom_nodes: signals.dom_stats.estimated_dom_nodes,
    html_size_kb: Math.round(signals.dom_stats.html_size_bytes / 1024),
    total_scripts: signals.scripts.total,
    render_blocking_scripts: signals.scripts.render_blocking.length,
    stylesheets: signals.css.stylesheet_count,
    total_images: signals.dom_stats.img_total,
    images_without_dimensions: signals.dom_stats.img_without_dimensions,
    third_party_domains: signals.third_party.domains.length,
  };
}

// ----- Per-Device Report (from Tier 2 LLM) -----

export interface DeviceReport {
  device: "mobile" | "desktop";
  field_metrics: {
    lcp: { p75: number; rating: VitalRating } | null;
    inp: { p75: number; rating: VitalRating } | null;
    cls: { p75: number; rating: VitalRating } | null;
  };
  lab_metrics: {
    performance_score: number;
    lcp: number;
    tbt: number;
    cls: number;
    fcp: number;
    si: number;
  };
  inp_analysis: { issues: Issue[] };
  lcp_analysis: { issues: Issue[] };
  cls_analysis: { issues: Issue[] };
  third_party_matrix: ThirdPartyEntry[];
  priority_table: PriorityFix[];
}

// ----- Top-Level Analysis Report -----

export interface AnalysisReport {
  id: string;
  url: string;
  timestamp: string;
  source_stats: SourceStats;
  mobile: DeviceReport | null;
  desktop: DeviceReport | null;
  warnings: string[];
  // PSI-only mode fields (stages 1-2 only, no LLM analysis)
  psi_only?: boolean;
  mobile_psi?: PSIResult;
  desktop_psi?: PSIResult;
}

// ----- Pipeline Status -----

export type PipelineStage = 1 | 2 | 3 | 4;
export type PipelineStageName =
  | "Collecting"
  | "Extracting"
  | "Analyzing"
  | "Generating";

export interface StageTimestamps {
  stage_1_start?: string;
  stage_1_end?: string;
  stage_2_start?: string;
  stage_2_end?: string;
  stage_3_start?: string;
  stage_3_end?: string;
  stage_4_start?: string;
  stage_4_end?: string;
}

export interface PipelineStatus {
  analysis_id: string;
  stage: PipelineStage;
  stage_name: PipelineStageName;
  progress_pct: number;
  detail?: string; // e.g. "Retrying mobile PSI (2/4)..."
  error?: string;
  stage_timestamps: StageTimestamps;
}

// ----- History -----

export interface HistoryEntry {
  analysis_id: string;
  url: string;
  timestamp: string;
  mobile_score: number | null;
  desktop_score: number | null;
  mobile_inp_rating: VitalRating | null;
  mobile_lcp_rating: VitalRating | null;
  mobile_cls_rating: VitalRating | null;
  desktop_inp_rating: VitalRating | null;
  desktop_lcp_rating: VitalRating | null;
  desktop_cls_rating: VitalRating | null;
}

// ----- Cost Tracking -----

export interface CostEntry {
  analysis_id: string;
  url: string;
  timestamp: string;
  tier: "extraction" | "intelligence";
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_total: number;
  latency_ms: number;
}

export interface CostSummary {
  total_spend: number;
  analyses: CostEntry[];
}

// ----- Settings -----

export interface AppSettings {
  extraction_model: string;
  intelligence_model: string;
}

export interface SettingsResponse extends AppSettings {
  google_key_status: string; // masked, e.g., "AIza...XXXX" or "Not set"
  openrouter_key_status: string; // masked
  available_models: string[];
  costs: CostSummary;
}
