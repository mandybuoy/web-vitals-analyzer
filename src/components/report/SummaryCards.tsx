"use client";

import type { DeviceReport, SourceStats } from "@/lib/types";
import ScoreGauge from "../ScoreGauge";
import RatingPill from "./RatingPill";

interface SummaryCardsProps {
  device: DeviceReport;
  sourceStats: SourceStats;
  techStack?: string[];
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

  return (
    <div className="space-y-4">
      {/* Primary metrics + score gauge */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Score gauge */}
        <div className="p-6 rounded-lg bg-vecton-dark border border-vecton-beige/6 focus-arrow flex items-center justify-center">
          <ScoreGauge
            score={lab_metrics.performance_score}
            size={120}
            label="Performance"
          />
        </div>

        {/* CWV Cards */}
        {primaryMetrics.map((m) => (
          <div
            key={m.label}
            className="p-4 rounded-lg bg-white/50 border border-vecton-dark/10"
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
        ))}
      </div>

      {/* Secondary stats (hidden when all data is zero) */}
      {(sourceStats.dom_nodes > 0 ||
        sourceStats.total_scripts > 0 ||
        sourceStats.third_party_domains > 0 ||
        sourceStats.html_size_kb > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {secondaryStats.map((s) => (
            <div
              key={s.label}
              className="p-3 rounded-lg bg-white/30 border border-vecton-dark/5"
            >
              <p className="text-xs text-vecton-dark/50 uppercase tracking-wider mb-1">
                {s.label}
              </p>
              <p className="text-sm text-vecton-dark/70 font-mono">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tech stack pills */}
      {techStack && techStack.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-vecton-dark/40 uppercase tracking-wider mr-1">
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
    </div>
  );
}
