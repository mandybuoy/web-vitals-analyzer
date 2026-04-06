"use client";

import type { AnalysisReport, VitalRating, PriorityFix } from "@/lib/types";
import RatingPill from "../report/RatingPill";

interface ComparisonViewProps {
  reportA: AnalysisReport;
  reportB: AnalysisReport;
  onClose: () => void;
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const RATING_ORDER: Record<VitalRating, number> = {
  poor: 0,
  needs_improvement: 1,
  good: 2,
};

function RatingDelta({
  ratingA,
  ratingB,
}: {
  ratingA: VitalRating | null;
  ratingB: VitalRating | null;
}) {
  if (!ratingA && !ratingB)
    return <span className="text-vecton-dark/30">—</span>;
  if (!ratingA || !ratingB)
    return <span className="text-vecton-dark/30">—</span>;

  const diff = RATING_ORDER[ratingB] - RATING_ORDER[ratingA];
  if (diff > 0) {
    return (
      <span className="text-vital-good text-xs font-mono">▲ improved</span>
    );
  }
  if (diff < 0) {
    return (
      <span className="text-vital-poor text-xs font-mono">▼ regressed</span>
    );
  }
  return <span className="text-vecton-dark/30 text-xs font-mono">— same</span>;
}

function ScoreDelta({ a, b }: { a: number | null; b: number | null }) {
  if (a == null || b == null)
    return <span className="text-vecton-dark/30">—</span>;
  const diff = Math.round(b - a);
  if (diff > 0) {
    return (
      <span className="text-vital-good text-xs font-mono font-medium">
        +{diff} ▲
      </span>
    );
  }
  if (diff < 0) {
    return (
      <span className="text-vital-poor text-xs font-mono font-medium">
        {diff} ▼
      </span>
    );
  }
  return <span className="text-vecton-dark/40 text-xs font-mono">0 —</span>;
}

function ScoreCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-vecton-dark/30">—</span>;
  const color =
    score >= 90
      ? "text-vital-good"
      : score >= 50
        ? "text-vital-needs"
        : "text-vital-poor";
  return (
    <span className={`text-sm font-mono font-medium ${color}`}>
      {Math.round(score)}
    </span>
  );
}

function diffPriorityFixes(
  fixesA: PriorityFix[],
  fixesB: PriorityFix[],
): {
  resolved: PriorityFix[];
  added: PriorityFix[];
  persistent: PriorityFix[];
} {
  const normalize = (s: string) => s.toLowerCase().slice(0, 80);
  const setA = new Set(fixesA.map((f) => normalize(f.fix)));
  const setB = new Set(fixesB.map((f) => normalize(f.fix)));

  const resolved = fixesA.filter((f) => !setB.has(normalize(f.fix)));
  const added = fixesB.filter((f) => !setA.has(normalize(f.fix)));
  const persistent = fixesB.filter((f) => setA.has(normalize(f.fix)));

  return { resolved, added, persistent };
}

export default function ComparisonView({
  reportA,
  reportB,
  onClose,
}: ComparisonViewProps) {
  // Sort by timestamp: A = older, B = newer
  const [older, newer] =
    reportA.timestamp < reportB.timestamp
      ? [reportA, reportB]
      : [reportB, reportA];

  const olderMobile = older.mobile;
  const newerMobile = newer.mobile;
  const olderDesktop = older.desktop;
  const newerDesktop = newer.desktop;

  // Issues diff (mobile priority table)
  const mobileDiff =
    olderMobile && newerMobile
      ? diffPriorityFixes(
          olderMobile.priority_table,
          newerMobile.priority_table,
        )
      : null;

  const metrics: {
    label: string;
    ratingA: VitalRating | null;
    ratingB: VitalRating | null;
  }[] = [
    {
      label: "Mobile LCP",
      ratingA: olderMobile?.field_metrics.lcp?.rating ?? null,
      ratingB: newerMobile?.field_metrics.lcp?.rating ?? null,
    },
    {
      label: "Mobile INP",
      ratingA: olderMobile?.field_metrics.inp?.rating ?? null,
      ratingB: newerMobile?.field_metrics.inp?.rating ?? null,
    },
    {
      label: "Mobile CLS",
      ratingA: olderMobile?.field_metrics.cls?.rating ?? null,
      ratingB: newerMobile?.field_metrics.cls?.rating ?? null,
    },
    {
      label: "Desktop LCP",
      ratingA: olderDesktop?.field_metrics.lcp?.rating ?? null,
      ratingB: newerDesktop?.field_metrics.lcp?.rating ?? null,
    },
    {
      label: "Desktop INP",
      ratingA: olderDesktop?.field_metrics.inp?.rating ?? null,
      ratingB: newerDesktop?.field_metrics.inp?.rating ?? null,
    },
    {
      label: "Desktop CLS",
      ratingA: olderDesktop?.field_metrics.cls?.rating ?? null,
      ratingB: newerDesktop?.field_metrics.cls?.rating ?? null,
    },
  ];

  return (
    <div className="mt-6 animate-fade-up">
      <div className="rounded-lg bg-white/30 border border-vecton-dark/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-vecton-dark/5">
          <div>
            <h4 className="text-xs text-vecton-dark/50 uppercase tracking-widest">
              Comparison
            </h4>
            <p className="text-xs text-vecton-dark/60 font-mono mt-0.5 truncate max-w-md">
              {older.url}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-vecton-dark/30 hover:text-vecton-dark/60 transition-colors focus-ring p-1"
          >
            <svg
              width="16"
              height="16"
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

        <div className="p-5 space-y-5">
          {/* Score comparison */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-[1px] bg-vecton-orange/40" />
              <h5 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest">
                Scores
              </h5>
              <div className="flex-1 h-[1px] bg-vecton-dark/10" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-vecton-dark/8">
                    <th className="text-left py-2 px-2 text-vecton-dark/40 uppercase tracking-wider font-normal">
                      Metric
                    </th>
                    <th className="text-center py-2 px-2 text-vecton-dark/40 font-normal">
                      {formatDate(older.timestamp)}
                    </th>
                    <th className="text-center py-2 px-2 text-vecton-dark/40 font-normal">
                      {formatDate(newer.timestamp)}
                    </th>
                    <th className="text-center py-2 px-2 text-vecton-dark/40 uppercase tracking-wider font-normal">
                      Change
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-vecton-dark/5">
                    <td className="py-2 px-2 text-vecton-dark/60">
                      Mobile Score
                    </td>
                    <td className="py-2 px-2 text-center">
                      <ScoreCell
                        score={
                          olderMobile?.lab_metrics.performance_score ?? null
                        }
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <ScoreCell
                        score={
                          newerMobile?.lab_metrics.performance_score ?? null
                        }
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <ScoreDelta
                        a={olderMobile?.lab_metrics.performance_score ?? null}
                        b={newerMobile?.lab_metrics.performance_score ?? null}
                      />
                    </td>
                  </tr>
                  <tr className="border-b border-vecton-dark/5">
                    <td className="py-2 px-2 text-vecton-dark/60">
                      Desktop Score
                    </td>
                    <td className="py-2 px-2 text-center">
                      <ScoreCell
                        score={
                          olderDesktop?.lab_metrics.performance_score ?? null
                        }
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <ScoreCell
                        score={
                          newerDesktop?.lab_metrics.performance_score ?? null
                        }
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <ScoreDelta
                        a={olderDesktop?.lab_metrics.performance_score ?? null}
                        b={newerDesktop?.lab_metrics.performance_score ?? null}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-metric ratings */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-[1px] bg-vecton-orange/40" />
              <h5 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest">
                Vital Ratings
              </h5>
              <div className="flex-1 h-[1px] bg-vecton-dark/10" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.label} className="border-b border-vecton-dark/5">
                      <td className="py-2 px-2 text-vecton-dark/60 w-[30%]">
                        {m.label}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {m.ratingA ? (
                          <RatingPill rating={m.ratingA} />
                        ) : (
                          <span className="text-vecton-dark/30">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {m.ratingB ? (
                          <RatingPill rating={m.ratingB} />
                        ) : (
                          <span className="text-vecton-dark/30">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <RatingDelta ratingA={m.ratingA} ratingB={m.ratingB} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Issues diff */}
          {mobileDiff && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-[1px] bg-vecton-orange/40" />
                <h5 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest">
                  Priority Fixes Diff
                </h5>
                <div className="flex-1 h-[1px] bg-vecton-dark/10" />
              </div>

              <div className="space-y-1.5">
                {mobileDiff.resolved.map((f, i) => (
                  <div
                    key={`r-${i}`}
                    className="flex items-start gap-2 px-3 py-2 rounded bg-vital-good/5 border border-vital-good/10"
                  >
                    <span className="text-vital-good text-xs font-mono flex-shrink-0 mt-0.5">
                      ✓ Resolved
                    </span>
                    <p className="text-xs text-vecton-dark/50 line-through">
                      {f.fix}
                    </p>
                  </div>
                ))}
                {mobileDiff.added.map((f, i) => (
                  <div
                    key={`a-${i}`}
                    className="flex items-start gap-2 px-3 py-2 rounded bg-vital-poor/5 border border-vital-poor/10"
                  >
                    <span className="text-vital-poor text-xs font-mono flex-shrink-0 mt-0.5">
                      + New
                    </span>
                    <p className="text-xs text-vecton-dark/70">{f.fix}</p>
                  </div>
                ))}
                {mobileDiff.persistent.map((f, i) => (
                  <div
                    key={`p-${i}`}
                    className="flex items-start gap-2 px-3 py-2 rounded bg-vecton-dark/3"
                  >
                    <span className="text-vecton-dark/30 text-xs font-mono flex-shrink-0 mt-0.5">
                      — Persists
                    </span>
                    <p className="text-xs text-vecton-dark/50">{f.fix}</p>
                  </div>
                ))}
                {mobileDiff.resolved.length === 0 &&
                  mobileDiff.added.length === 0 &&
                  mobileDiff.persistent.length === 0 && (
                    <p className="text-xs text-vecton-dark/30 text-center py-2">
                      No priority fix data available for comparison
                    </p>
                  )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
