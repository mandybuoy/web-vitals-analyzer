"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisReport } from "@/lib/types";
import * as api from "@/lib/api";
import ComparisonView from "@/components/history/ComparisonView";

export default function ComparePage({
  params,
}: {
  params: Promise<{ id1: string; id2: string }>;
}) {
  const router = useRouter();
  const [reportA, setReportA] = useState<AnalysisReport | null>(null);
  const [reportB, setReportB] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { id1, id2 } = await params;
        const [a, b] = await Promise.all([
          api.getReport(id1),
          api.getReport(id2),
        ]);
        if (!cancelled) {
          setReportA(a);
          setReportB(b);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load reports for comparison",
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Back link */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-xs text-vecton-dark/40 hover:text-vecton-orange transition-colors mb-6 focus-ring"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to home
        </button>

        {/* Loading */}
        {loading && (
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
              <p className="text-sm text-white">Loading comparison...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="max-w-2xl mx-auto p-4 rounded-lg bg-vital-poor/8 border border-vital-poor/15 flex items-start gap-3 animate-fade-up">
            <svg
              className="w-4 h-4 text-vital-poor flex-shrink-0 mt-0.5"
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
              <p className="text-sm text-vital-poor">Comparison failed</p>
              <p className="text-xs text-vital-poor/60 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Comparison */}
        {reportA && reportB && (
          <ComparisonView
            reportA={reportA}
            reportB={reportB}
            onClose={() => router.push("/")}
          />
        )}
      </div>
    </div>
  );
}
