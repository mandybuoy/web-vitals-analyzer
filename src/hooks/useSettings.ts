"use client";

import { useState, useEffect, useCallback } from "react";
import type { SettingsResponse, AppSettings } from "@/lib/types";
import * as api from "@/lib/api";

export function useSettings() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(
    async (updates: Partial<AppSettings>) => {
      setError(null);
      try {
        await api.updateSettings(updates);
        await load();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save settings",
        );
      }
    },
    [load],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { settings, loading, error, save, refresh: load };
}
