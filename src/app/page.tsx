"use client";

import { useState } from "react";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useHistory } from "@/hooks/useHistory";
import ReportView from "@/components/report/ReportView";
import ProgressBar from "@/components/progress/ProgressBar";
import HistoryList from "@/components/history/HistoryList";
import SettingsPanel from "@/components/settings/SettingsPanel";

export default function Home() {
  const [url, setUrl] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const analysis = useAnalysis();
  const history = useHistory();

  const handleAnalyze = async () => {
    if (!url.trim()) return;

    let targetUrl = url.trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
    }

    await analysis.start(targetUrl);
    // Refresh history after starting (it will show when done)
    setTimeout(() => history.refresh(), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && analysis.state !== "running") {
      handleAnalyze();
    }
  };

  const handleHistorySelect = async (id: string) => {
    await analysis.loadReport(id);
  };

  const isRunning = analysis.state === "running";
  const isDone = analysis.state === "done";
  const isError = analysis.state === "error";

  return (
    <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-5 h-[1px] bg-vecton-orange/60" />
            <span className="text-[11px] text-vecton-orange uppercase tracking-[0.2em]">
              Web Vitals Analysis
            </span>
            <div className="w-5 h-[1px] bg-vecton-orange/60" />
          </div>

          <div className="flex items-center justify-center gap-3">
            <h1 className="text-4xl sm:text-5xl text-vecton-dark leading-brand tracking-tight mb-4">
              Vital<span className="text-vecton-orange">Scan</span>
            </h1>
          </div>
          <p className="text-vecton-dark/60 max-w-md mx-auto text-sm leading-brand">
            Paste any URL. Get a full Core Web Vitals audit with AI-powered
            root-cause analysis and prioritized fixes.
          </p>

          {/* Settings gear */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="absolute top-6 right-6 text-vecton-dark/30 hover:text-vecton-dark/60 transition-colors"
            title="Settings"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div className="relative max-w-2xl mx-auto mb-8">
          <div className="relative flex items-center bg-vecton-dark border border-vecton-beige/10 rounded-lg overflow-hidden focus-within:border-vecton-orange/30 transition-colors">
            <svg
              className="w-4 h-4 text-white/60 ml-4 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter URL to analyze (e.g., example.com)"
              className="flex-1 bg-transparent text-white placeholder-white/50 px-4 py-4 text-sm font-mono focus:outline-none"
              disabled={isRunning}
            />
            <button
              onClick={isDone ? () => analysis.reset() : handleAnalyze}
              disabled={!url.trim() && !isDone}
              className="mr-2 px-5 py-2.5 bg-vecton-orange hover:bg-vecton-orange/90 disabled:bg-vecton-beige/8 disabled:text-vecton-beige/20 text-vecton-light text-sm rounded-md transition-all flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray="32"
                      strokeLinecap="round"
                    />
                  </svg>
                  Analyzing...
                </>
              ) : isDone ? (
                "New Analysis"
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                  Analyze
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress */}
        {isRunning && analysis.status && (
          <div className="max-w-2xl mx-auto mb-8">
            <ProgressBar status={analysis.status} onCancel={analysis.cancel} />
          </div>
        )}

        {/* Running but no status yet */}
        {isRunning && !analysis.status && (
          <div className="text-center py-16 animate-fade-up">
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-lg bg-vecton-dark border border-vecton-beige/8">
              <svg
                className="w-4 h-4 text-vecton-orange animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray="32"
                  strokeLinecap="round"
                />
              </svg>
              <div className="text-left">
                <p className="text-sm text-white">Starting analysis...</p>
                <p className="text-[11px] text-white/50">
                  Initializing pipeline
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="max-w-2xl mx-auto p-4 rounded-lg bg-[#ff4e42]/8 border border-[#ff4e42]/15 flex items-start gap-3 animate-fade-up">
            <svg
              className="w-4 h-4 text-[#ff4e42] flex-shrink-0 mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="text-sm text-[#ff4e42]">Analysis Failed</p>
              <p className="text-[11px] text-[#ff4e42]/60 mt-1">
                {analysis.error}
              </p>
              <button
                onClick={handleAnalyze}
                className="text-[11px] text-vecton-orange underline mt-2"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Report */}
        {isDone && analysis.report && <ReportView report={analysis.report} />}

        {/* History (idle only) */}
        {analysis.state === "idle" && history.history.length > 0 && (
          <HistoryList
            entries={history.history}
            onSelect={handleHistorySelect}
          />
        )}

        {/* Footer */}
        <footer className="text-center mt-16 pb-8">
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-[1px] bg-vecton-dark/20" />
            <p className="text-[11px] text-vecton-dark/50 uppercase tracking-widest">
              Powered by Google PSI &amp; AI Analysis
            </p>
            <div className="w-8 h-[1px] bg-vecton-dark/20" />
          </div>
        </footer>
      </div>

      {/* Settings panel */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
