"use client";

import { useState } from "react";
import type { Issue } from "@/lib/types";
import { track } from "@/lib/analytics";
import SeverityPill from "./SeverityPill";
import DifficultyPill from "./DifficultyPill";

interface IssueCardProps {
  issue: Issue;
  metric?: string;
  defaultOpen?: boolean;
}

const EVIDENCE_STYLES: Record<string, string> = {
  measured: "bg-vital-good/10 text-vital-good",
  inferred: "bg-vital-needs/10 text-vital-needs",
  best_practice: "bg-vecton-dark/5 text-vecton-dark/50",
};

export default function IssueCard({
  issue,
  metric,
  defaultOpen = false,
}: IssueCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isObservation = issue.is_observation === true;

  return (
    <div
      className={`rounded-lg overflow-hidden border ${
        isObservation
          ? "bg-blue-50/30 border-blue-300/20"
          : "bg-white/50 border-vecton-dark/10"
      }`}
    >
      <button
        onClick={() => {
          if (!open) {
            track("issue_expanded", {
              metric,
              issue_name: issue.name,
              severity: issue.severity,
              type: issue.type,
              is_observation: isObservation,
            });
          }
          setOpen(!open);
        }}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-vecton-dark/3 transition-colors focus-ring"
      >
        <svg
          className={`w-3 h-3 text-vecton-dark/40 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="flex-1 text-sm text-vecton-dark/80">{issue.name}</span>
        <div className="flex items-center gap-2">
          {isObservation ? (
            <span className="text-xs px-2.5 py-1 rounded uppercase tracking-wider bg-blue-500/10 text-blue-600">
              info
            </span>
          ) : (
            <>
              <SeverityPill severity={issue.severity} />
              <DifficultyPill difficulty={issue.difficulty} />
            </>
          )}
        </div>
      </button>
      <div
        className="grid transition-all duration-200"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 border-t border-vecton-dark/5">
            <p className="text-xs text-vecton-dark/60 mb-3">
              {issue.description}
            </p>
            {!isObservation && (
              <div className="p-3 rounded bg-vecton-orange/5 border border-vecton-orange/10">
                <p className="text-xs text-vecton-orange/60 uppercase tracking-wider mb-1">
                  Fix
                </p>
                <p className="text-xs text-vecton-dark/70 font-mono whitespace-pre-wrap">
                  {issue.fix}
                </p>
              </div>
            )}
            {!isObservation && issue.trade_off && (
              <div className="mt-2 p-3 rounded bg-amber-50 border border-amber-200/30">
                <p className="text-xs text-amber-700/60 uppercase tracking-wider mb-1">
                  Trade-off
                </p>
                <p className="text-xs text-amber-800/70 font-mono whitespace-pre-wrap">
                  {issue.trade_off}
                </p>
              </div>
            )}
            {issue.code_example && (
              <div className="mt-2">
                {issue.is_generic_example === true && (
                  <p className="text-xs text-amber-600/70 mb-1 italic">
                    Generic pattern — actual implementation may vary
                  </p>
                )}
                <div className="p-3 rounded bg-vecton-dark border border-vecton-dark/20 overflow-x-auto">
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
                    Code
                  </p>
                  <pre className="text-xs text-green-300/90 font-mono whitespace-pre-wrap leading-relaxed">
                    <code>{issue.code_example}</code>
                  </pre>
                </div>
              </div>
            )}
            {(issue.impact_metric || issue.evidence_basis) && (
              <div className="flex items-center gap-3 mt-2">
                {issue.impact_metric && (
                  <p className="text-xs text-vecton-dark/50 font-mono">
                    Impact: {issue.impact_metric}
                  </p>
                )}
                {issue.evidence_basis && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded font-mono ${
                      EVIDENCE_STYLES[issue.evidence_basis] ?? ""
                    }`}
                  >
                    {issue.evidence_basis.replace("_", " ")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
