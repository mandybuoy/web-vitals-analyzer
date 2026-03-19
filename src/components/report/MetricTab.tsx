"use client";

import { useState } from "react";
import type { Issue, ScriptImpactItem } from "@/lib/types";
import IssueCard from "./IssueCard";

interface MetricTabProps {
  issues: Issue[];
  metricLabel: string;
  scriptSummary?: ScriptImpactItem[];
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function truncateUrl(url: string, maxLen = 55): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + "...";
}

function ScriptSummarySection({ scripts }: { scripts: ScriptImpactItem[] }) {
  const [expanded, setExpanded] = useState(true);
  const sorted = [...scripts].sort(
    (a, b) => (b.mainThreadTime ?? 0) - (a.mainThreadTime ?? 0),
  );

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 mb-3 w-full text-left"
      >
        <div className="w-4 h-[1px] bg-[#ff4e42]/40" />
        <h4 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest">
          Scripts by Main Thread Time
        </h4>
        <div className="flex-1 h-[1px] bg-vecton-dark/10" />
        <svg
          className={`w-3 h-3 text-vecton-dark/30 transition-transform ${expanded ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-vecton-dark/10">
                <th className="text-left py-1.5 px-2 text-vecton-dark/50 font-medium">
                  Script URL
                </th>
                <th className="text-right py-1.5 px-2 text-vecton-dark/50 font-medium">
                  Main Thread
                </th>
                <th className="text-right py-1.5 px-2 text-vecton-dark/50 font-medium">
                  Size
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr key={i} className="border-b border-vecton-dark/5">
                  <td
                    className="py-1.5 px-2 font-mono text-vecton-dark/70"
                    title={s.url}
                  >
                    {truncateUrl(s.url)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-[#ff4e42]/80">
                    {s.mainThreadTime != null
                      ? `${Math.round(s.mainThreadTime)}ms`
                      : "—"}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-vecton-dark/50">
                    {formatBytes(s.totalBytes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export default function MetricTab({
  issues,
  metricLabel,
  scriptSummary,
}: MetricTabProps) {
  const sorted = [...issues].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  const observations = sorted.filter((i) => i.is_observation === true);
  const firstParty = sorted.filter(
    (i) => i.type === "first_party" && !i.is_observation,
  );
  const thirdParty = sorted.filter(
    (i) => i.type === "third_party" && !i.is_observation,
  );

  if (issues.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-vecton-dark/40">
        No {metricLabel} issues identified
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* INP Script Summary — shows top scripts by main thread time */}
      {scriptSummary && scriptSummary.length > 0 && (
        <ScriptSummarySection scripts={scriptSummary} />
      )}

      {firstParty.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-[1px] bg-vecton-orange/40" />
            <h4 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest">
              First-Party Issues
            </h4>
            <div className="flex-1 h-[1px] bg-vecton-dark/10" />
          </div>
          <div className="space-y-2">
            {firstParty.map((issue, i) => (
              <IssueCard
                key={`fp-${i}`}
                issue={issue}
                metric={metricLabel}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        </div>
      )}

      {thirdParty.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-[1px] bg-vecton-orange/40" />
            <h4 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest">
              Third-Party Issues
            </h4>
            <div className="flex-1 h-[1px] bg-vecton-dark/10" />
          </div>
          <div className="space-y-2">
            {thirdParty.map((issue, i) => (
              <IssueCard key={`tp-${i}`} issue={issue} metric={metricLabel} />
            ))}
          </div>
        </div>
      )}

      {observations.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-[1px] bg-blue-400/40" />
            <h4 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest">
              Observations
            </h4>
            <div className="flex-1 h-[1px] bg-vecton-dark/10" />
          </div>
          <div className="space-y-2">
            {observations.map((issue, i) => (
              <IssueCard key={`obs-${i}`} issue={issue} metric={metricLabel} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
