// In-memory pipeline state store (survives Next.js hot-reloads via globalThis)

import type { PipelineStatus, StageTimestamps } from "./types";

export interface PipelineState {
  status: PipelineStatus;
  abortController: AbortController;
  createdAt: number;
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

// ----- Concurrency Gate -----

export function isAnyPipelineRunning(): boolean {
  let running = false;
  store.forEach((state) => {
    if (!state.status.error && state.status.progress_pct < 100) {
      running = true;
    }
  });
  return running;
}

export function getRunningPipelineId(): string | null {
  let foundId: string | null = null;
  store.forEach((state, id) => {
    if (!state.status.error && state.status.progress_pct < 100) {
      foundId = id;
    }
  });
  return foundId;
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

export function setError(analysisId: string, error: string): void {
  const state = store.get(analysisId);
  if (!state) return;
  state.status.error = error;
}

export function setComplete(analysisId: string): void {
  const state = store.get(analysisId);
  if (!state) return;
  const timestamps = state.status.stage_timestamps;
  timestamps.stage_4_end = new Date().toISOString();
  state.status.stage = 4;
  state.status.stage_name = "Generating";
  state.status.progress_pct = 100;
}
