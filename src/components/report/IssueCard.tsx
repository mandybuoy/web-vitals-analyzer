"use client";

import { useState } from "react";
import type { Issue } from "@/lib/types";
import SeverityPill from "./SeverityPill";
import DifficultyPill from "./DifficultyPill";

interface IssueCardProps {
  issue: Issue;
  defaultOpen?: boolean;
}

export default function IssueCard({
  issue,
  defaultOpen = false,
}: IssueCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg bg-white/50 border border-vecton-dark/10 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-vecton-dark/3 transition-colors"
      >
        <svg
          className={`w-3 h-3 text-vecton-dark/40 flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="flex-1 text-sm text-vecton-dark/80">{issue.name}</span>
        <div className="flex items-center gap-2">
          <SeverityPill severity={issue.severity} />
          <DifficultyPill difficulty={issue.difficulty} />
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
            <div className="p-3 rounded bg-vecton-orange/5 border border-vecton-orange/10">
              <p className="text-[10px] text-vecton-orange/60 uppercase tracking-wider mb-1">
                Fix
              </p>
              <p className="text-xs text-vecton-dark/70 font-mono whitespace-pre-wrap">
                {issue.fix}
              </p>
            </div>
            {issue.code_example && (
              <div className="mt-2 p-3 rounded bg-vecton-dark border border-vecton-dark/20 overflow-x-auto">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">
                  Code
                </p>
                <pre className="text-xs text-green-300/90 font-mono whitespace-pre-wrap leading-relaxed">
                  <code>{issue.code_example}</code>
                </pre>
              </div>
            )}
            {issue.impact_metric && (
              <p className="text-[10px] text-vecton-dark/40 mt-2 font-mono">
                Impact: {issue.impact_metric}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
