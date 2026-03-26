// In-memory pipeline state store (survives Next.js hot-reloads via globalThis)

import type {
  PipelineStatus,
  StageTimestamps,
  AnalysisReport,
  CollectionProgress,
} from "./types";

export interface PipelineState {
  status: PipelineStatus;
  abortController: AbortController;
  createdAt: number;
  report?: AnalysisReport; // In-memory report for PSI-only mode (not saved to DB)
}

// globalThis pattern to survive hot-reloads
const globalForPipeline = globalThis as unknown as {
  __pipelineStore: Map<string, PipelineState> | undefined;
};

export const store: Map<string, PipelineState> =
  (globalForPipeline.__pipelineStore ??= new Map());

// Auto-clean entries older than 1 hour (runs every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_AGE_MS = 60 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  store.forEach((state, id) => {
    if (now - state.createdAt > MAX_AGE_MS) {
      store.delete(id);
    }
  });
}

// Only set up interval once via globalThis
const globalForCleanup = globalThis as unknown as {
  __pipelineCleanupInterval: ReturnType<typeof setInterval> | undefined;
};
if (!globalForCleanup.__pipelineCleanupInterval) {
  globalForCleanup.__pipelineCleanupInterval = setInterval(
    cleanup,
    CLEANUP_INTERVAL_MS,
  );
}

// ----- Pipeline State Operations -----

export function createPipeline(analysisId: string): PipelineState {
  const state: PipelineState = {
    status: {
      analysis_id: analysisId,
      stage: 1,
      stage_name: "Collecting",
      progress_pct: 0,
      stage_timestamps: {
        stage_1_start: new Date().toISOString(),
      },
      collection_progress: {
        psi_desktop: "pending",
        psi_mobile: "pending",
        html_fetch: "pending",
        html_extract: "pending",
      },
    },
    abortController: new AbortController(),
    createdAt: Date.now(),
  };
  store.set(analysisId, state);
  return state;
}

export function getPipelineStatus(analysisId: string): PipelineStatus | null {
  return store.get(analysisId)?.status ?? null;
}

export function getAbortSignal(analysisId: string): AbortSignal | undefined {
  return store.get(analysisId)?.abortController.signal;
}

export function cancelPipeline(analysisId: string): boolean {
  const state = store.get(analysisId);
  if (!state) return false;
  state.abortController.abort();
  state.status.error = "Cancelled by user";
  return true;
}

export function updateStage(
  analysisId: string,
  stage: 1 | 2 | 3 | 4,
  stageName: "Collecting" | "Extracting" | "Analyzing" | "Generating",
  progressPct: number,
): void {
  const state = store.get(analysisId);
  if (!state) return;

  const prevStage = state.status.stage;
  const timestamps = state.status.stage_timestamps;

  // End previous stage
  if (prevStage !== stage) {
    const endKey = `stage_${prevStage}_end` as keyof StageTimestamps;
    timestamps[endKey] = new Date().toISOString();

    // Start new stage
    const startKey = `stage_${stage}_start` as keyof StageTimestamps;
    timestamps[startKey] = new Date().toISOString();
  }

  state.status.stage = stage;
  state.status.stage_name = stageName;
  state.status.progress_pct = progressPct;
}

export function setDetail(
  analysisId: string,
  detail: string | undefined,
): void {
  const state = store.get(analysisId);
  if (!state) return;
  state.status.detail = detail;
}

export function updateCollectionProgress(
  analysisId: string,
  updates: Partial<CollectionProgress>,
): void {
  const state = store.get(analysisId);
  if (!state || !state.status.collection_progress) return;
  Object.assign(state.status.collection_progress, updates);

  // Auto-update progress_pct: 25% per completed sub-task
  const cp = state.status.collection_progress;
  let done = 0;
  if (cp.psi_desktop === "done" || cp.psi_desktop === "failed") done++;
  if (cp.psi_mobile === "done" || cp.psi_mobile === "failed") done++;
  if (cp.html_fetch === "done" || cp.html_fetch === "failed") done++;
  if (cp.html_extract === "done" || cp.html_extract === "failed") done++;
  state.status.progress_pct = done * 25;
}

export function setError(analysisId: string, error: string): void {
  const state = store.get(analysisId);
  if (!state) return;
  state.status.error = error;
}

export function setInMemoryReport(
  analysisId: string,
  report: AnalysisReport,
): void {
  const state = store.get(analysisId);
  if (!state) return;
  state.report = report;
}

export function getInMemoryReport(
  analysisId: string,
): AnalysisReport | undefined {
  return store.get(analysisId)?.report;
}

export function setComplete(analysisId: string): void {
  const state = store.get(analysisId);
  if (!state) return;
  const timestamps = state.status.stage_timestamps;
  timestamps.stage_4_end = new Date().toISOString();
  state.status.stage = 4;
  state.status.stage_name = "Generating";
  state.status.progress_pct = 100;
  state.status.error = undefined; // Clear any abort/cancel error — report was saved
  state.status.detail = undefined;
}
