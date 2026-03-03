"use client";

import { useEffect, useRef, useCallback } from "react";

export function usePolling<T>(options: {
  fetcher: (signal: AbortSignal) => Promise<T>;
  onData: (data: T) => void;
  onError: (error: Error) => void;
  shouldStop: (data: T) => boolean;
  enabled: boolean;
  intervalMs?: number;
}) {
  const {
    fetcher,
    onData,
    onError,
    shouldStop,
    enabled,
    intervalMs = 2000,
  } = options;
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const data = await fetcher(controller.signal);
        if (!mountedRef.current) return;

        onData(data);

        if (shouldStop(data)) {
          return;
        }
      } catch (err) {
        if (!mountedRef.current) return;
        if (err instanceof Error && err.name === "AbortError") return;
        onError(err instanceof Error ? err : new Error("Polling error"));
        return;
      }

      if (mountedRef.current) {
        timeoutId = setTimeout(poll, intervalMs);
      }
    };

    poll();

    return () => {
      clearTimeout(timeoutId);
      stop();
    };
  }, [enabled, fetcher, onData, onError, shouldStop, intervalMs, stop]);

  return { stop };
}
