"use client";

import type { DeviceReport, SourceStats, NetworkStackInfo } from "@/lib/types";
import ScoreGauge from "../ScoreGauge";
import RatingPill from "./RatingPill";

interface SummaryCardsProps {
  device: DeviceReport;
  sourceStats: SourceStats;
  techStack?: string[];
  networkStack?: NetworkStackInfo;
}

function formatMetricValue(metric: string, value: number): string {
  if (metric === "cls") return value.toFixed(3);
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

export default function SummaryCards({
  device,
  sourceStats,
  techStack,
  networkStack,
}: SummaryCardsProps) {
  const { field_metrics, lab_metrics } = device;

  const primaryMetrics = [
    {
      label: "FCP",
      field: field_metrics.fcp,
      labValue: lab_metrics.fcp,
      metric: "fcp",
    },
    {
      label: "LCP",
      field: field_metrics.lcp,
      labValue: lab_metrics.lcp,
      metric: "lcp",
    },
    {
      label: "INP",
      field: field_metrics.inp,
      labValue: lab_metrics.tbt, // TBT as INP proxy
      metric: "inp",
    },
    {
      label: "CLS",
      field: field_metrics.cls,
      labValue: lab_metrics.cls,
      metric: "cls",
    },
  ];

  const secondaryStats = [
    { label: "DOM Nodes", value: sourceStats.dom_nodes.toLocaleString() },
    { label: "HTML Size", value: `${sourceStats.html_size_kb} KB` },
    {
      label: "Scripts",
      value: `${sourceStats.total_scripts} (${sourceStats.render_blocking_scripts} blocking)`,
    },
    { label: "3P Domains", value: String(sourceStats.third_party_domains) },
  ];

  const hasSecondaryStats =
    sourceStats.dom_nodes > 0 ||
    sourceStats.total_scripts > 0 ||
    sourceStats.third_party_domains > 0 ||
    sourceStats.html_size_kb > 0;
  const hasTechStack = techStack && techStack.length > 0;
  const hasInfra = hasTechStack || networkStack;

  return (
    <div>
      {/* Primary metrics + score gauge — hero area, staggered reveal */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 stagger-children">
        {/* Score gauge — spans full width on mobile */}
        <div className="col-span-2 md:col-span-1 p-6 rounded-lg bg-vecton-dark border border-vecton-beige/6 focus-arrow flex items-center justify-center">
          <ScoreGauge
            score={lab_metrics.performance_score}
            size={120}
            label="Performance"
          />
        </div>

        {/* CWV Cards — 2-col mobile, individual on desktop */}
        {primaryMetrics.map((m) => {
          const rating = m.field?.rating;
          const accentColor =
            rating === "good"
              ? "border-l-vital-good"
              : rating === "needs_improvement"
                ? "border-l-vital-needs"
                : rating === "poor"
                  ? "border-l-vital-poor"
                  : "border-l-transparent";
          return (
            <div
              key={m.label}
              className={`p-4 rounded-lg bg-white/50 border border-vecton-dark/10 border-l-[3px] ${accentColor}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-vecton-dark/50 uppercase tracking-wider">
                  {m.label}
                </span>
                {m.field?.rating && <RatingPill rating={m.field.rating} />}
              </div>
              {m.field ? (
                <>
                  <p className="text-2xl text-vecton-dark font-mono">
                    {formatMetricValue(m.metric, m.field.p75)}
                  </p>
                  <p className="text-xs text-vecton-dark/50 mt-1">
                    p75 field data
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl text-vecton-dark font-mono">
                    {formatMetricValue(m.metric, m.labValue)}
                  </p>
                  <p className="text-xs text-vecton-dark/50 mt-1">
                    lab data {m.label === "INP" ? "(TBT proxy)" : ""}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Page info section — tighter group, separated from hero metrics */}
      {(hasSecondaryStats || hasInfra) && (
        <div className="mt-6 pt-5 border-t border-vecton-dark/5 space-y-3">
          {/* Secondary stats row */}
          {hasSecondaryStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {secondaryStats.map((s) => (
                <div key={s.label} className="px-3 py-2 rounded bg-white/30">
                  <p className="text-[11px] text-vecton-dark/40 uppercase tracking-wider">
                    {s.label}
                  </p>
                  <p className="text-sm text-vecton-dark/70 font-mono">
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Infrastructure pills — tech stack + network grouped tightly */}
          {hasInfra && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {/* Tech stack */}
              {hasTechStack && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-vecton-dark/35 uppercase tracking-wider">
                    Stack
                  </span>
                  {techStack.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 rounded-full bg-vecton-orange/10 text-vecton-orange/80 border border-vecton-orange/15"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Separator dot when both present */}
              {hasTechStack && networkStack && (
                <div className="w-[3px] h-[3px] rounded-full bg-vecton-dark/15" />
              )}

              {/* Network stack */}
              {networkStack && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-vecton-dark/35 uppercase tracking-wider">
                    Network
                  </span>
                  {networkStack.cdn ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600/80 border border-blue-500/15">
                      CDN: {networkStack.cdn}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-vecton-dark/5 text-vecton-dark/35 border border-vecton-dark/8">
                      No CDN
                    </span>
                  )}
                  {networkStack.server && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600/80 border border-purple-500/15">
                      {networkStack.server}
                    </span>
                  )}
                  {networkStack.compression && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600/80 border border-green-500/15">
                      {networkStack.compression}
                    </span>
                  )}
                  {networkStack.cacheStatus && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        networkStack.cacheStatus.toUpperCase().includes("HIT")
                          ? "bg-green-500/10 text-green-600/80 border-green-500/15"
                          : "bg-amber-500/10 text-amber-600/80 border-amber-500/15"
                      }`}
                    >
                      Cache: {networkStack.cacheStatus}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
