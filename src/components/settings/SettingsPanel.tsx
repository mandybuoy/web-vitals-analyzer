"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";
import { track } from "@/lib/analytics";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { settings, loading, error, save, refresh } = useSettings();
  const [extractionModel, setExtractionModel] = useState("");
  const [intelligenceModel, setIntelligenceModel] = useState("");
  const [showCosts, setShowCosts] = useState(false);

  useEffect(() => {
    if (settings) {
      setExtractionModel(settings.extraction_model);
      setIntelligenceModel(settings.intelligence_model);
    }
  }, [settings]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

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
            <div className="mb-4 p-3 rounded bg-[#ff4e42]/8 border border-[#ff4e42]/15 text-xs text-[#ff4e42]">
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
                    <p className="text-[10px] text-vecton-dark/40 uppercase tracking-wider mb-1">
                      Google PSI
                    </p>
                    <p className="text-xs text-vecton-dark/70 font-mono">
                      {settings.google_key_status}
                    </p>
                    <p className="text-[10px] text-vecton-dark/30 mt-1">
                      Set via .env file
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/50 border border-vecton-dark/10">
                    <p className="text-[10px] text-vecton-dark/40 uppercase tracking-wider mb-1">
                      Anthropic
                    </p>
                    <p className="text-xs text-vecton-dark/70 font-mono">
                      {settings.openrouter_key_status}
                    </p>
                    <p className="text-[10px] text-vecton-dark/30 mt-1">
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
                    <label className="text-[10px] text-vecton-dark/40 uppercase tracking-wider block mb-1">
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
                    <label className="text-[10px] text-vecton-dark/40 uppercase tracking-wider block mb-1">
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

              {/* Cost Tracker */}
              <div>
                <button
                  onClick={() => setShowCosts(!showCosts)}
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
                      <p className="text-[10px] text-vecton-orange/60 uppercase tracking-wider mb-1">
                        Total Spend
                      </p>
                      <p className="text-lg text-vecton-dark font-mono">
                        ${settings.costs.total_spend.toFixed(4)}
                      </p>
                    </div>

                    {settings.costs.analyses.length > 0 ? (
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {settings.costs.analyses
                          .slice(0, 20)
                          .map((entry, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2 rounded bg-white/30 text-[10px]"
                            >
                              <div>
                                <span className="text-vecton-dark/50 font-mono">
                                  {entry.model.split("/").pop()}
                                </span>
                                <span className="text-vecton-dark/30 ml-2">
                                  {entry.tier}
                                </span>
                              </div>
                              <span className="text-vecton-dark/60 font-mono">
                                ${entry.cost_total.toFixed(4)}
                              </span>
                            </div>
                          ))}
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
