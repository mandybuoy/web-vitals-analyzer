"use client";

import type { Issue } from "@/lib/types";
import IssueCard from "./IssueCard";

interface MetricTabProps {
  issues: Issue[];
  metricLabel: string;
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export default function MetricTab({ issues, metricLabel }: MetricTabProps) {
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
              <IssueCard key={`fp-${i}`} issue={issue} defaultOpen={i === 0} />
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
              <IssueCard key={`tp-${i}`} issue={issue} />
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
              <IssueCard key={`obs-${i}`} issue={issue} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
