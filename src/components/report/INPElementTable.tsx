"use client";

import { useState } from "react";
import type { INPElementRisk, INPRiskLevel } from "@/lib/types";

interface INPElementTableProps {
  elements: INPElementRisk[];
}

const RISK_STYLES: Record<INPRiskLevel, string> = {
  high: "bg-vital-poor/10 text-vital-poor",
  medium: "bg-vital-needs/10 text-vital-needs",
  low: "bg-vital-good/10 text-vital-good",
};

const RISK_ORDER: Record<INPRiskLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const INTERACTION_STYLES: Record<string, string> = {
  Click: "bg-vecton-orange/10 text-vecton-orange/80",
  Type: "bg-vecton-purple/10 text-vecton-purple/80",
  Keypress: "bg-blue-500/10 text-blue-600/80",
};

function truncateSelector(sel: string, max = 45): string {
  if (sel.length <= max) return sel;
  return sel.slice(0, max - 3) + "...";
}

function ElementRow({ element }: { element: INPElementRisk }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg overflow-hidden border border-vecton-dark/10 bg-white/50">
      <button
        onClick={() => setOpen(!open)}
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

        <div className="flex-1 min-w-0">
          <p className="text-sm text-vecton-dark/80 truncate">
            {element.label}
          </p>
          <p
            className="text-[11px] text-vecton-dark/40 font-mono truncate"
            title={element.selector}
          >
            {truncateSelector(element.selector)}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full ${INTERACTION_STYLES[element.interaction_type] ?? "bg-vecton-dark/5 text-vecton-dark/50"}`}
          >
            {element.interaction_type}
          </span>
          <span
            className={`text-xs px-2.5 py-1 rounded uppercase tracking-wider ${RISK_STYLES[element.risk]}`}
          >
            {element.risk}
          </span>
        </div>
      </button>

      {/* Expandable detail */}
      <div
        className="grid transition-all duration-200"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 border-t border-vecton-dark/5">
            {/* Reason */}
            <p className="text-xs text-vecton-dark/60 mb-3">{element.reason}</p>

            {/* Contributing scripts */}
            {element.contributing_scripts.length > 0 && (
              <div className="mb-3">
                <p className="text-[11px] text-vecton-dark/40 uppercase tracking-wider mb-1">
                  Contributing Scripts
                </p>
                <div className="space-y-1">
                  {element.contributing_scripts.map((script, i) => (
                    <p
                      key={i}
                      className="text-[11px] text-vecton-dark/50 font-mono truncate"
                      title={script}
                    >
                      {script}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendation */}
            <div className="p-2.5 rounded bg-vecton-orange/5 border border-vecton-orange/10">
              <p className="text-[11px] text-vecton-orange/60 uppercase tracking-wider mb-0.5">
                Fix
              </p>
              <p className="text-xs text-vecton-dark/70">
                {element.recommendation}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function INPElementTable({ elements }: INPElementTableProps) {
  const sorted = [...elements].sort(
    (a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk],
  );

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-4 h-[1px] bg-vecton-purple/40" />
        <h4 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest">
          Element INP Risk
        </h4>
        <div className="flex-1 h-[1px] bg-vecton-dark/10" />
      </div>

      {/* Info banner */}
      <div className="px-3 py-2 rounded bg-vecton-dark/5 border border-vecton-dark/8 mb-3">
        <p className="text-[11px] text-vecton-dark/40">
          Risk assessment based on HTML structure, script analysis, and main
          thread blocking data
        </p>
      </div>

      <div className="space-y-2">
        {sorted.map((el, i) => (
          <ElementRow key={i} element={el} />
        ))}
      </div>
    </div>
  );
}
