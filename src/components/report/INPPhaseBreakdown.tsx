"use client";

import type { INPPhaseBreakdown as INPPhaseBreakdownType } from "@/lib/types";

interface INPPhaseBreakdownProps {
  breakdown: INPPhaseBreakdownType;
}

const PHASES = [
  { key: "input_delay_ms", label: "Input Delay", color: "bg-vital-needs" },
  { key: "processing_ms", label: "Processing", color: "bg-vital-poor" },
  {
    key: "presentation_delay_ms",
    label: "Presentation",
    color: "bg-vecton-purple",
  },
] as const;

export default function INPPhaseBreakdown({
  breakdown,
}: INPPhaseBreakdownProps) {
  const total = breakdown.total_inp_ms;
  if (total <= 0) return null;

  const ratingColor =
    total < 200
      ? "text-vital-good"
      : total < 500
        ? "text-vital-needs"
        : "text-vital-poor";

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-4 h-[1px] bg-vecton-orange/40" />
        <h4 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest">
          INP Phase Breakdown
        </h4>
        <div className="flex-1 h-[1px] bg-vecton-dark/10" />
        <span className={`text-sm font-mono font-medium ${ratingColor}`}>
          {total}ms
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-8 rounded-lg overflow-hidden border border-vecton-dark/10">
        {PHASES.map((phase) => {
          const value = breakdown[phase.key];
          const pct = total > 0 ? (value / total) * 100 : 0;
          if (pct < 1) return null;
          return (
            <div
              key={phase.key}
              className={`${phase.color} flex items-center justify-center min-w-[40px] transition-all`}
              style={{ width: `${pct}%` }}
              title={`${phase.label}: ${value}ms (${Math.round(pct)}%)`}
            >
              {pct > 15 && (
                <span className="text-[10px] text-white/90 font-mono truncate px-1">
                  {value}ms
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Phase labels */}
      <div className="flex mt-2 gap-4">
        {PHASES.map((phase) => {
          const value = breakdown[phase.key];
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <div key={phase.key} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${phase.color}`} />
              <span className="text-[11px] text-vecton-dark/50">
                {phase.label}
              </span>
              <span className="text-[11px] text-vecton-dark/70 font-mono">
                {value}ms
              </span>
              <span className="text-[11px] text-vecton-dark/30">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
