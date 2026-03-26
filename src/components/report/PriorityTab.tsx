"use client";

import type { PriorityFix } from "@/lib/types";
import SeverityPill from "./SeverityPill";
import DifficultyPill from "./DifficultyPill";
import MetricPills from "./MetricPills";

interface PriorityTabProps {
  fixes: PriorityFix[];
}

const EVIDENCE_STYLES: Record<string, string> = {
  measured: "bg-vital-good/10 text-vital-good",
  inferred: "bg-vital-needs/10 text-vital-needs",
  best_practice: "bg-vecton-dark/5 text-vecton-dark/50",
};

export default function PriorityTab({ fixes }: PriorityTabProps) {
  if (fixes.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-vecton-dark/40">
        No priority fixes identified
      </div>
    );
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-vecton-dark/10">
              <th className="text-left text-xs text-vecton-dark/50 uppercase tracking-wider p-3 w-8">
                #
              </th>
              <th className="text-left text-xs text-vecton-dark/50 uppercase tracking-wider p-3">
                Fix
              </th>
              <th className="text-left text-xs text-vecton-dark/50 uppercase tracking-wider p-3">
                Affects
              </th>
              <th className="text-left text-xs text-vecton-dark/50 uppercase tracking-wider p-3">
                Severity
              </th>
              <th className="text-left text-xs text-vecton-dark/50 uppercase tracking-wider p-3">
                Difficulty
              </th>
              <th className="text-left text-xs text-vecton-dark/50 uppercase tracking-wider p-3">
                Evidence
              </th>
              <th className="text-left text-xs text-vecton-dark/50 uppercase tracking-wider p-3">
                Est. Improvement
              </th>
            </tr>
          </thead>
          <tbody>
            {fixes.map((fix, i) => (
              <tr
                key={i}
                className="border-b border-vecton-dark/5 hover:bg-white/30"
              >
                <td className="p-3 text-sm text-vecton-orange font-mono">
                  {fix.rank}
                </td>
                <td className="p-3 text-xs text-vecton-dark/70">{fix.fix}</td>
                <td className="p-3">
                  <MetricPills metrics={fix.affects} />
                </td>
                <td className="p-3">
                  <SeverityPill severity={fix.severity} />
                </td>
                <td className="p-3">
                  <DifficultyPill difficulty={fix.difficulty} />
                </td>
                <td className="p-3">
                  {fix.evidence_basis && (
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded font-mono ${
                        EVIDENCE_STYLES[fix.evidence_basis] ?? ""
                      }`}
                    >
                      {fix.evidence_basis.replace("_", " ")}
                    </span>
                  )}
                </td>
                <td className="p-3 text-xs text-vecton-dark/60 font-mono">
                  {fix.estimated_improvement}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {fixes.map((fix, i) => (
          <div
            key={i}
            className="p-3 rounded-lg bg-white/50 border border-vecton-dark/10"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-vecton-orange font-mono">
                #{fix.rank}
              </span>
              <SeverityPill severity={fix.severity} />
              <DifficultyPill difficulty={fix.difficulty} />
              {fix.evidence_basis && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded font-mono ${
                    EVIDENCE_STYLES[fix.evidence_basis] ?? ""
                  }`}
                >
                  {fix.evidence_basis.replace("_", " ")}
                </span>
              )}
            </div>
            <p className="text-xs text-vecton-dark/70 mb-2">{fix.fix}</p>
            <div className="flex items-center justify-between">
              <MetricPills metrics={fix.affects} />
              <span className="text-xs text-vecton-dark/50 font-mono">
                {fix.estimated_improvement}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
