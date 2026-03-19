// Frontend fetch wrappers for all API endpoints

import type {
  PipelineStatus,
  AnalysisReport,
  HistoryEntry,
  SettingsResponse,
  AppSettings,
  PromptsResponse,
} from "./types";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.json();
}

// Start a new analysis — returns analysis_id
export async function startAnalysis(
  url: string,
  psiOnly?: boolean,
  techStack?: string,
): Promise<{ analysis_id: string }> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      ...(psiOnly && { psi_only: true }),
      ...(techStack && { tech_stack: techStack }),
    }),
  });

  if (response.status === 429) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Analysis already in progress");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Failed to start analysis");
  }

  return response.json();
}

// Cancel a running analysis
export async function cancelAnalysis(id: string): Promise<void> {
  const response = await fetch(`/api/analyze/${id}`, {
    method: "DELETE",
  });
  // 204 = cancelled, 200 = already completed, 404 = not found
  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Failed to cancel analysis");
  }
}

// Poll pipeline status
export async function getStatus(
  id: string,
  signal?: AbortSignal,
): Promise<PipelineStatus> {
  return fetchJson<PipelineStatus>(`/api/status/${id}`, { signal });
}

// Fetch completed report
export async function getReport(id: string): Promise<AnalysisReport> {
  return fetchJson<AnalysisReport>(`/api/report/${id}`);
}

// Fetch analysis history
export async function getHistory(): Promise<HistoryEntry[]> {
  return fetchJson<HistoryEntry[]>("/api/history");
}

// Fetch settings
export async function getSettings(): Promise<SettingsResponse> {
  return fetchJson<SettingsResponse>("/api/settings");
}

// Update settings (model selections only)
export async function updateSettings(
  settings: Partial<AppSettings>,
): Promise<void> {
  await fetchJson("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}

// Fetch prompts
export async function getPrompts(): Promise<PromptsResponse> {
  return fetchJson<PromptsResponse>("/api/prompts");
}

// Update prompts
export async function savePrompts(
  updates: Partial<
    Pick<PromptsResponse, "extraction_system_prompt" | "tier2_system_prompt">
  >,
): Promise<void> {
  await fetchJson("/api/prompts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

// Reset prompts to defaults
export async function resetPrompts(
  keys: ("extraction_system_prompt" | "tier2_system_prompt")[],
): Promise<void> {
  await fetchJson("/api/prompts", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys }),
  });
}
