"use client";

import { useState, useEffect, useCallback } from "react";
import { useSettings } from "@/hooks/useSettings";
import { track } from "@/lib/analytics";
import type { PromptsResponse } from "@/lib/types";
import * as api from "@/lib/api";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { settings, loading, error, save, refresh } = useSettings();
  const [extractionModel, setExtractionModel] = useState("");
  const [intelligenceModel, setIntelligenceModel] = useState("");
  const [showCosts, setShowCosts] = useState(false);

  // Prompt editor state
  const [showPrompts, setShowPrompts] = useState(false);
  const [prompts, setPrompts] = useState<PromptsResponse | null>(null);
  const [extractionPrompt, setExtractionPrompt] = useState("");
  const [tier2Prompt, setTier2Prompt] = useState("");
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptsSaving, setPromptsSaving] = useState(false);
  const [promptsError, setPromptsError] = useState<string | null>(null);

  const loadPrompts = useCallback(async () => {
    setPromptsLoading(true);
    setPromptsError(null);
    try {
      const data = await api.getPrompts();
      setPrompts(data);
      setExtractionPrompt(data.extraction_system_prompt);
      setTier2Prompt(data.tier2_system_prompt);
    } catch (err) {
      setPromptsError(
        err instanceof Error ? err.message : "Failed to load prompts",
      );
    } finally {
      setPromptsLoading(false);
    }
  }, []);

  const handleSavePrompts = async () => {
    setPromptsSaving(true);
    setPromptsError(null);
    try {
      const updates: Record<string, string> = {};
      if (extractionPrompt !== prompts?.extraction_system_prompt) {
        updates.extraction_system_prompt = extractionPrompt;
      }
      if (tier2Prompt !== prompts?.tier2_system_prompt) {
        updates.tier2_system_prompt = tier2Prompt;
      }
      if (Object.keys(updates).length > 0) {
        await api.savePrompts(updates);
        track("prompts_saved", { keys: Object.keys(updates) });
        await loadPrompts();
      }
    } catch (err) {
      setPromptsError(
        err instanceof Error ? err.message : "Failed to save prompts",
      );
    } finally {
      setPromptsSaving(false);
    }
  };

  const handleResetPrompt = async (
    key: "extraction_system_prompt" | "tier2_system_prompt",
  ) => {
    setPromptsError(null);
    try {
      await api.resetPrompts([key]);
      track("prompt_reset", { key });
      await loadPrompts();
    } catch (err) {
      setPromptsError(
        err instanceof Error ? err.message : "Failed to reset prompt",
      );
    }
  };

  const hasPromptChanges =
    prompts &&
    (extractionPrompt !== prompts.extraction_system_prompt ||
      tier2Prompt !== prompts.tier2_system_prompt);

  useEffect(() => {
    if (settings) {
      setExtractionModel(settings.extraction_model);
      setIntelligenceModel(settings.intelligence_model);
    }
  }, [settings]);

  useEffect(() => {
    if (open) {
      refresh();
      loadPrompts();
    }
  }, [open, refresh, loadPrompts]);

  const handleSave = async () => {
    await save({
      extraction_model: extractionModel,
      intelligence_model: intelligenceModel,
    });
    track("settings_saved", {
      extraction_model: extractionModel,
      intelligence_model: intelligenceModel,
    });
  };

  const hasChanges =
    settings &&
    (extractionModel !== settings.extraction_model ||
      intelligenceModel !== settings.intelligence_model);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-vecton-beige border-l border-vecton-dark/10 z-50 overflow-y-auto shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg text-vecton-dark">Settings</h2>
            <button
              onClick={onClose}
              className="text-vecton-dark/40 hover:text-vecton-dark transition-colors"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {loading && (
            <p className="text-sm text-vecton-dark/40">Loading settings...</p>
          )}

          {error && (
            <div className="mb-4 p-3 rounded bg-vital-poor/8 border border-vital-poor/15 text-xs text-vital-poor">
              {error}
            </div>
          )}

          {settings && (
            <>
              {/* API Keys */}
              <div className="mb-8">
                <h3 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest mb-3">
                  API Keys
                </h3>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-white/50 border border-vecton-dark/10">
                    <p className="text-xs text-vecton-dark/50 uppercase tracking-wider mb-1">
                      Google PSI
                    </p>
                    <p className="text-xs text-vecton-dark/70 font-mono">
                      {settings.google_key_status}
                    </p>
                    <p className="text-xs text-vecton-dark/50 mt-1">
                      Set via .env file
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/50 border border-vecton-dark/10">
                    <p className="text-xs text-vecton-dark/50 uppercase tracking-wider mb-1">
                      Anthropic
                    </p>
                    <p className="text-xs text-vecton-dark/70 font-mono">
                      {settings.openrouter_key_status}
                    </p>
                    <p className="text-xs text-vecton-dark/50 mt-1">
                      Set via .env file
                    </p>
                  </div>
                </div>
              </div>

              {/* Model Selection */}
              <div className="mb-8">
                <h3 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest mb-3">
                  Models
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-vecton-dark/50 uppercase tracking-wider block mb-1">
                      Extraction (HTML analysis)
                    </label>
                    <select
                      value={extractionModel}
                      onChange={(e) => setExtractionModel(e.target.value)}
                      className="w-full p-2 rounded bg-white/50 border border-vecton-dark/10 text-xs text-vecton-dark/70 font-mono"
                    >
                      {settings.available_models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-vecton-dark/50 uppercase tracking-wider block mb-1">
                      Intelligence (deep analysis)
                    </label>
                    <select
                      value={intelligenceModel}
                      onChange={(e) => setIntelligenceModel(e.target.value)}
                      className="w-full p-2 rounded bg-white/50 border border-vecton-dark/10 text-xs text-vecton-dark/70 font-mono"
                    >
                      {settings.available_models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  {hasChanges && (
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-vecton-orange text-white text-xs rounded hover:bg-vecton-orange/90 transition-colors"
                    >
                      Save Changes
                    </button>
                  )}
                </div>
              </div>

              {/* Prompts */}
              <div className="mb-8">
                <button
                  onClick={() => {
                    track("prompts_section_toggled", {
                      expanded: !showPrompts,
                    });
                    setShowPrompts(!showPrompts);
                  }}
                  className="flex items-center gap-2 mb-3"
                >
                  <h3 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest">
                    Prompts
                  </h3>
                  <svg
                    className={`w-3 h-3 text-vecton-dark/30 transition-transform ${showPrompts ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {showPrompts && (
                  <div className="space-y-4">
                    {promptsLoading && (
                      <p className="text-xs text-vecton-dark/40">
                        Loading prompts...
                      </p>
                    )}

                    {promptsError && (
                      <div className="p-2 rounded bg-vital-poor/8 border border-vital-poor/15 text-xs text-vital-poor">
                        {promptsError}
                      </div>
                    )}

                    {prompts && !promptsLoading && (
                      <>
                        {/* Extraction prompt */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-vecton-dark/50 uppercase tracking-wider">
                              Extraction (HTML analysis)
                            </label>
                            {prompts.is_extraction_custom && (
                              <button
                                onClick={() =>
                                  handleResetPrompt("extraction_system_prompt")
                                }
                                className="text-[11px] text-vecton-orange hover:text-vecton-orange/80 transition-colors"
                              >
                                Reset to default
                              </button>
                            )}
                          </div>
                          <textarea
                            value={extractionPrompt}
                            onChange={(e) =>
                              setExtractionPrompt(e.target.value)
                            }
                            rows={12}
                            className="w-full p-3 rounded bg-white/50 border border-vecton-dark/10 text-xs text-vecton-dark/70 font-mono leading-relaxed resize-y"
                            spellCheck={false}
                          />
                          {prompts.is_extraction_custom && (
                            <p className="text-[11px] text-vecton-orange/60 mt-0.5">
                              Custom prompt active
                            </p>
                          )}
                        </div>

                        {/* Tier 2 prompt */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-vecton-dark/50 uppercase tracking-wider">
                              Intelligence (deep analysis)
                            </label>
                            {prompts.is_tier2_custom && (
                              <button
                                onClick={() =>
                                  handleResetPrompt("tier2_system_prompt")
                                }
                                className="text-[11px] text-vecton-orange hover:text-vecton-orange/80 transition-colors"
                              >
                                Reset to default
                              </button>
                            )}
                          </div>
                          <textarea
                            value={tier2Prompt}
                            onChange={(e) => setTier2Prompt(e.target.value)}
                            rows={15}
                            className="w-full p-3 rounded bg-white/50 border border-vecton-dark/10 text-xs text-vecton-dark/70 font-mono leading-relaxed resize-y"
                            spellCheck={false}
                          />
                          {prompts.is_tier2_custom && (
                            <p className="text-[11px] text-vecton-orange/60 mt-0.5">
                              Custom prompt active
                            </p>
                          )}
                        </div>

                        {/* Save button */}
                        {hasPromptChanges && (
                          <button
                            onClick={handleSavePrompts}
                            disabled={promptsSaving}
                            className="px-4 py-2 bg-vecton-orange text-white text-xs rounded hover:bg-vecton-orange/90 disabled:opacity-50 transition-colors"
                          >
                            {promptsSaving
                              ? "Saving..."
                              : "Save Prompt Changes"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Cost Tracker */}
              <div>
                <button
                  onClick={() => {
                    track("cost_tracker_toggled", {
                      expanded: !showCosts,
                    });
                    setShowCosts(!showCosts);
                  }}
                  className="flex items-center gap-2 mb-3"
                >
                  <h3 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest">
                    Cost Tracker
                  </h3>
                  <svg
                    className={`w-3 h-3 text-vecton-dark/30 transition-transform ${showCosts ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {showCosts && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-vecton-orange/5 border border-vecton-orange/10">
                      <p className="text-xs text-vecton-orange/60 uppercase tracking-wider mb-1">
                        Total Spend
                      </p>
                      <p className="text-lg text-vecton-dark font-mono">
                        ${settings.costs.total_spend.toFixed(4)}
                      </p>
                      <p className="text-[11px] text-vecton-dark/40 mt-1">
                        {settings.costs.analyses.length} LLM calls across all
                        scans
                      </p>
                    </div>

                    {/* Per-scan cost breakdown */}
                    {settings.costs.analyses.length > 0 ? (
                      <div className="space-y-1.5 max-h-72 overflow-y-auto">
                        {(() => {
                          // Group by analysis_id to show per-scan totals
                          const scans = new Map<
                            string,
                            {
                              url: string;
                              calls: number;
                              cost: number;
                              tokens: number;
                              timestamp: string;
                            }
                          >();
                          settings.costs.analyses.forEach((entry) => {
                            const existing = scans.get(entry.analysis_id);
                            if (existing) {
                              existing.calls++;
                              existing.cost += entry.cost_total;
                              existing.tokens +=
                                entry.input_tokens + entry.output_tokens;
                            } else {
                              scans.set(entry.analysis_id, {
                                url: entry.url || "unknown",
                                calls: 1,
                                cost: entry.cost_total,
                                tokens:
                                  entry.input_tokens + entry.output_tokens,
                                timestamp: entry.timestamp,
                              });
                            }
                          });

                          return Array.from(scans.values())
                            .sort(
                              (a, b) =>
                                new Date(b.timestamp).getTime() -
                                new Date(a.timestamp).getTime(),
                            )
                            .slice(0, 15)
                            .map((scan, i) => (
                              <div
                                key={i}
                                className="p-2 rounded bg-white/30 border border-vecton-dark/5"
                              >
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-xs text-vecton-dark/60 font-mono truncate max-w-[65%]">
                                    {
                                      scan.url
                                        .replace(/^https?:\/\//, "")
                                        .split("/")[0]
                                    }
                                  </span>
                                  <span
                                    className={`text-xs font-mono font-medium ${
                                      scan.cost > 2
                                        ? "text-vital-poor"
                                        : scan.cost > 1
                                          ? "text-vital-needs"
                                          : "text-vital-good"
                                    }`}
                                  >
                                    ${scan.cost.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-vecton-dark/35">
                                  <span>{scan.calls} calls</span>
                                  <span>
                                    {Math.round(scan.tokens / 1000)}K tokens
                                  </span>
                                  <span className="ml-auto">
                                    {new Date(
                                      scan.timestamp,
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            ));
                        })()}
                      </div>
                    ) : (
                      <p className="text-xs text-vecton-dark/30">
                        No cost data yet
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
