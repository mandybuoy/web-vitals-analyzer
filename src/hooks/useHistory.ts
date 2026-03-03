"use client";

import { useState, useEffect, useCallback } from "react";
import type { HistoryEntry } from "@/lib/types";
import * as api from "@/lib/api";

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getHistory();
      setHistory(data);
    } catch {
      // Non-fatal — history is optional
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { history, loading, refresh: load };
}
