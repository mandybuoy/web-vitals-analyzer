"use client";

import { useState, useCallback, useRef } from "react";
import type { PipelineStatus, AnalysisReport } from "@/lib/types";
import * as api from "@/lib/api";
import { usePolling } from "./usePolling";

export type AnalysisState = "idle" | "running" | "done" | "error";

export interface UseAnalysisReturn {
  state: AnalysisState;
  analysisId: string | null;
  status: PipelineStatus | null;
  report: AnalysisReport | null;
  error: string | null;
  start: (
    url: string,
    psiOnly?: boolean,
    techStack?: string[],
  ) => Promise<void>;
  cancel: () => Promise<void>;
  loadReport: (id: string) => Promise<void>;
  reset: () => void;
}

const STALL_TIMEOUT_MS = 480_000; // 8 min — matches server pipeline hard timeout

export function useAnalysis(): UseAnalysisReturn {
  const [state, setState] = useState<AnalysisState>("idle");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const lastProgressRef = useRef<{ pct: number; detail: string; time: number }>(
    {
      pct: 0,
      detail: "",
      time: Date.now(),
    },
  );

  const handleStatusUpdate = useCallback(async (data: PipelineStatus) => {
    setStatus(data);

    // Check for error
    if (data.error) {
      setState("error");
      setError(data.error);
      setPolling(false);
      return;
    }

    // Check stall timeout — reset timer on ANY status change (progress OR detail/heartbeat)
    const currentDetail =
      data.detail || data.collection_progress?.psi_detail || "";
    if (
      data.progress_pct !== lastProgressRef.current.pct ||
      currentDetail !== lastProgressRef.current.detail
    ) {
      lastProgressRef.current = {
        pct: data.progress_pct,
        detail: currentDetail,
        time: Date.now(),
      };
    } else if (Date.now() - lastProgressRef.current.time > STALL_TIMEOUT_MS) {
      setState("error");
      setError(
        "Analysis timed out — no progress for 8 minutes. The site may be unreachable or too complex for Google PSI.",
      );
      setPolling(false);
      return;
    }

    // Check completion
    if (data.progress_pct >= 100) {
      try {
        const rpt = await api.getReport(data.analysis_id);
        setReport(rpt);
        setState("done");
      } catch {
        setState("error");
        setError("Analysis completed but report could not be loaded");
      }
      setPolling(false);
    }
  }, []);

  const handleStatusError = useCallback((err: Error) => {
    if (err.message.includes("not found")) {
      setState("error");
      setError("Analysis expired or server restarted");
    } else {
      setState("error");
      setError(err.message);
    }
    setPolling(false);
  }, []);

  const shouldStopPolling = useCallback(
    (data: PipelineStatus) => !!data.error || data.progress_pct >= 100,
    [],
  );

  const statusFetcher = useCallback(
    (signal: AbortSignal) => {
      if (!analysisId) throw new Error("No analysis ID");
      return api.getStatus(analysisId, signal);
    },
    [analysisId],
  );

  usePolling({
    fetcher: statusFetcher,
    onData: handleStatusUpdate,
    onError: handleStatusError,
    shouldStop: shouldStopPolling,
    enabled: polling && !!analysisId,
  });

  const start = useCallback(
    async (url: string, psiOnly?: boolean, techStack?: string[]) => {
      // Reset state
      setError(null);
      setReport(null);
      setStatus(null);
      setState("running");

      try {
        const { analysis_id } = await api.startAnalysis(
          url,
          psiOnly,
          techStack,
        );
        setAnalysisId(analysis_id);
        lastProgressRef.current = { pct: 0, detail: "", time: Date.now() };
        setPolling(true);
      } catch (err) {
        setState("error");
        setError(
          err instanceof Error ? err.message : "Failed to start analysis",
        );
      }
    },
    [],
  );

  const cancel = useCallback(async () => {
    setPolling(false);
    if (analysisId) {
      try {
        await api.cancelAnalysis(analysisId);
      } catch {
        // Best effort
      }
    }
    setState("idle");
    setAnalysisId(null);
    setStatus(null);
  }, [analysisId]);

  const loadReport = useCallback(async (id: string) => {
    setState("running");
    setError(null);
    try {
      const rpt = await api.getReport(id);
      setReport(rpt);
      setAnalysisId(id);
      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Failed to load report");
    }
  }, []);

  const reset = useCallback(() => {
    setPolling(false);
    setState("idle");
    setAnalysisId(null);
    setStatus(null);
    setReport(null);
    setError(null);
  }, []);

  return {
    state,
    analysisId,
    status,
    report,
    error,
    start,
    cancel,
    loadReport,
    reset,
  };
}
