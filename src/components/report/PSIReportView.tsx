"use client";

import { useState } from "react";
import type { AnalysisReport, PSIResult, SourceStats } from "@/lib/types";
import ScoreGauge from "../ScoreGauge";

interface PSIReportViewProps {
  report: AnalysisReport;
}

function formatMetricValue(metric: string, value: number): string {
  if (metric === "cls") return value.toFixed(3);
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

function scoreColor(score: number): string {
  if (score >= 0.9) return "text-[#0cce6b]";
  if (score >= 0.5) return "text-[#ffa400]";
  return "text-[#ff4e42]";
}

function scoreBg(score: number): string {
  if (score >= 0.9) return "bg-[#0cce6b]/10";
  if (score >= 0.5) return "bg-[#ffa400]/10";
  return "bg-[#ff4e42]/10";
}

function FieldDataBadge({
  category,
}: {
  category: "FAST" | "AVERAGE" | "SLOW";
}) {
  const styles = {
    FAST: "bg-[#0cce6b]/10 text-[#0cce6b]",
    AVERAGE: "bg-[#ffa400]/10 text-[#ffa400]",
    SLOW: "bg-[#ff4e42]/10 text-[#ff4e42]",
  };
  const labels = { FAST: "Good", AVERAGE: "Needs Work", SLOW: "Poor" };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded ${styles[category]}`}>
      {labels[category]}
    </span>
  );
}

function MetricsGrid({ psi }: { psi: PSIResult }) {
  const cwvMetrics = [
    {
      label: "LCP",
      value: psi.metrics.lcp.value,
      score: psi.metrics.lcp.score,
      metric: "lcp",
      field: psi.fieldData?.lcp,
    },
    {
      label: "INP",
      value: psi.metrics.tbt.value,
      score: psi.metrics.tbt.score,
      metric: "inp",
      field: psi.fieldData?.inp,
      labNote: "TBT proxy",
    },
    {
      label: "CLS",
      value: psi.metrics.cls.value,
      score: psi.metrics.cls.score,
      metric: "cls",
      field: psi.fieldData?.cls,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Score gauge */}
      <div className="p-6 rounded-lg bg-vecton-dark border border-vecton-beige/6 flex items-center justify-center">
        <ScoreGauge
          score={Math.round(psi.overallScore)}
          size={120}
          label="Performance"
        />
      </div>

      {/* CWV cards */}
      {cwvMetrics.map((m) => (
        <div
          key={m.label}
          className="p-4 rounded-lg bg-white/50 border border-vecton-dark/10"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-vecton-dark/50 uppercase tracking-wider">
              {m.label}
            </span>
            {m.field && <FieldDataBadge category={m.field.category} />}
          </div>
          {m.field ? (
            <>
              <p className="text-2xl text-vecton-dark font-mono">
                {formatMetricValue(m.metric, m.field.percentile)}
              </p>
              <p className="text-[10px] text-vecton-dark/40 mt-1">
                p75 field data
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl text-vecton-dark font-mono">
                {formatMetricValue(m.metric, m.value)}
              </p>
              <p className="text-[10px] text-vecton-dark/40 mt-1">
                lab data {m.labNote ? `(${m.labNote})` : ""}
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function LabMetricsRow({ psi }: { psi: PSIResult }) {
  const secondary = [
    {
      label: "FCP",
      value: psi.metrics.fcp.value,
      score: psi.metrics.fcp.score,
      metric: "fcp",
    },
    {
      label: "Speed Index",
      value: psi.metrics.si.value,
      score: psi.metrics.si.score,
      metric: "si",
    },
    {
      label: "TBT",
      value: psi.metrics.tbt.value,
      score: psi.metrics.tbt.score,
      metric: "tbt",
    },
    {
      label: "TTFB",
      value: psi.metrics.ttfb.value,
      score: psi.metrics.ttfb.score,
      metric: "ttfb",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {secondary.map((m) => (
        <div
          key={m.label}
          className="p-3 rounded-lg bg-white/30 border border-vecton-dark/5"
        >
          <p className="text-[10px] text-vecton-dark/40 uppercase tracking-wider mb-1">
            {m.label}
          </p>
          <p className={`text-sm font-mono ${scoreColor(m.score)}`}>
            {formatMetricValue(m.metric, m.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function SourceStatsRow({ stats }: { stats: SourceStats }) {
  const items = [
    { label: "DOM Nodes", value: stats.dom_nodes.toLocaleString() },
    { label: "HTML Size", value: `${stats.html_size_kb} KB` },
    {
      label: "Scripts",
      value: `${stats.total_scripts} (${stats.render_blocking_scripts} blocking)`,
    },
    { label: "3P Domains", value: String(stats.third_party_domains) },
  ];

  const hasData =
    stats.dom_nodes > 0 ||
    stats.total_scripts > 0 ||
    stats.third_party_domains > 0 ||
    stats.html_size_kb > 0;

  if (!hasData) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((s) => (
        <div
          key={s.label}
          className="p-3 rounded-lg bg-white/30 border border-vecton-dark/5"
        >
          <p className="text-[10px] text-vecton-dark/40 uppercase tracking-wider mb-1">
            {s.label}
          </p>
          <p className="text-sm text-vecton-dark/70 font-mono">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function DiagnosticsSection({
  diagnostics,
}: {
  diagnostics: PSIResult["diagnostics"];
}) {
  const [expanded, setExpanded] = useState(false);
  const items = diagnostics.filter((d) => d.score !== null && d.score < 1);
  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, 5);

  return (
    <div>
      <h3 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest mb-3">
        Diagnostics
      </h3>
      <div className="space-y-2">
        {visible.map((d) => (
          <div
            key={d.id}
            className="p-3 rounded-lg bg-white/30 border border-vecton-dark/5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-vecton-dark/80">{d.title}</p>
              {d.displayValue && (
                <span className="text-[10px] text-vecton-dark/40 font-mono flex-shrink-0">
                  {d.displayValue}
                </span>
              )}
            </div>
            <p className="text-[10px] text-vecton-dark/40 mt-1 line-clamp-2">
              {d.description}
            </p>
          </div>
        ))}
      </div>
      {items.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-vecton-orange mt-2"
        >
          {expanded ? "Show less" : `Show all ${items.length} diagnostics`}
        </button>
      )}
    </div>
  );
}

function OpportunitiesSection({
  opportunities,
}: {
  opportunities: PSIResult["opportunities"];
}) {
  const items = opportunities.filter((o) => o.score !== null && o.score < 1);
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest mb-3">
        Opportunities
      </h3>
      <div className="space-y-2">
        {items.map((o) => (
          <div
            key={o.id}
            className="p-3 rounded-lg bg-white/30 border border-vecton-dark/5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-vecton-dark/80">{o.title}</p>
              {o.savings && (
                <span
                  className={`text-[10px] font-mono flex-shrink-0 px-1.5 py-0.5 rounded ${scoreBg(o.score ?? 0)} ${scoreColor(o.score ?? 0)}`}
                >
                  {o.savings}
                </span>
              )}
            </div>
            <p className="text-[10px] text-vecton-dark/40 mt-1 line-clamp-2">
              {o.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PSIReportView({ report }: PSIReportViewProps) {
  const hasMobile = !!report.mobile_psi;
  const hasDesktop = !!report.desktop_psi;
  const defaultDevice = hasMobile ? "mobile" : "desktop";
  const [activeDevice, setActiveDevice] = useState<"mobile" | "desktop">(
    defaultDevice,
  );

  const psi =
    activeDevice === "mobile" ? report.mobile_psi : report.desktop_psi;

  return (
    <div
      className="mt-10 animate-fade-up"
      style={{ animationFillMode: "forwards" }}
    >
      {/* URL & timestamp */}
      <div className="mb-6">
        <p className="text-[11px] text-vecton-dark/60 font-mono truncate">
          {report.url}
        </p>
        <p className="text-[11px] text-vecton-dark/40 mt-1">
          Analyzed {new Date(report.timestamp).toLocaleString()}
        </p>
      </div>

      {/* Warnings */}
      {report.warnings.length > 0 && (
        <div className="mb-4 space-y-1">
          {report.warnings.map((w, i) => (
            <div
              key={i}
              className="text-[11px] text-[#ffa400] bg-[#ffa400]/8 border border-[#ffa400]/15 px-3 py-1.5 rounded"
            >
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Device toggle */}
      <div className="flex gap-2 mb-8">
        {(["mobile", "desktop"] as const).map((tab) => {
          const available = tab === "mobile" ? hasMobile : hasDesktop;
          const isActive = activeDevice === tab;
          const tabPsi =
            tab === "mobile" ? report.mobile_psi : report.desktop_psi;
          const score = tabPsi ? Math.round(tabPsi.overallScore) : undefined;

          return (
            <button
              key={tab}
              onClick={() => {
                if (available) setActiveDevice(tab);
              }}
              disabled={!available}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all
                ${
                  isActive
                    ? "bg-vecton-orange/10 text-vecton-orange border border-vecton-orange/20"
                    : available
                      ? "bg-vecton-dark/5 text-vecton-dark/60 border border-vecton-dark/10 hover:bg-vecton-dark/8"
                      : "bg-vecton-dark/3 text-vecton-dark/20 border border-vecton-dark/5 cursor-not-allowed"
                }`}
            >
              {tab === "mobile" ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              )}
              <span className="capitalize">{tab}</span>
              {score !== undefined && (
                <span
                  className={`ml-1 text-[11px] px-1.5 py-0.5 rounded
                    ${
                      score >= 90
                        ? "bg-[#0cce6b]/10 text-[#0cce6b]"
                        : score >= 50
                          ? "bg-[#ffa400]/10 text-[#ffa400]"
                          : "bg-[#ff4e42]/10 text-[#ff4e42]"
                    }`}
                >
                  {score}
                </span>
              )}
              {!available && (
                <span className="text-[10px] text-vecton-dark/30">
                  unavailable
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Report content */}
      {psi ? (
        <div className="space-y-6">
          <MetricsGrid psi={psi} />
          <LabMetricsRow psi={psi} />
          <SourceStatsRow stats={report.source_stats} />
          <OpportunitiesSection opportunities={psi.opportunities} />
          <DiagnosticsSection diagnostics={psi.diagnostics} />
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-vecton-dark/40">
          No data available for {activeDevice}
        </div>
      )}
    </div>
  );
}
