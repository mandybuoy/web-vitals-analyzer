"use client";

import { useState } from "react";
import type { ThirdPartyEntry, Severity } from "@/lib/types";
import { track } from "@/lib/analytics";
import SeverityPill from "./SeverityPill";

interface ThirdPartyTabProps {
  entries: ThirdPartyEntry[];
}

type SortKey =
  | "script_name"
  | "category"
  | "lcp_impact"
  | "cls_impact"
  | "inp_impact"
  | "recommendation";
type SortDir = "asc" | "desc";

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const ACTION_COLORS: Record<string, string> = {
  remove: "bg-vital-poor/10 text-vital-poor",
  defer: "bg-vital-needs/10 text-vital-needs",
  lazy_load: "bg-blue-500/10 text-blue-600",
  keep: "bg-vital-good/10 text-vital-good",
};

export default function ThirdPartyTab({ entries }: ThirdPartyTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>("lcp_impact");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-vecton-dark/40">
        No third-party scripts detected
      </div>
    );
  }

  const sorted = [...entries].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];

    // Severity-based sorting
    if (sortKey.endsWith("_impact")) {
      const diff =
        SEVERITY_ORDER[aVal as Severity] - SEVERITY_ORDER[bVal as Severity];
      return sortDir === "asc" ? diff : -diff;
    }

    // String sorting
    const diff = String(aVal).localeCompare(String(bVal));
    return sortDir === "asc" ? diff : -diff;
  });

  const toggleSort = (key: SortKey) => {
    const newDir =
      sortKey === key ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    if (sortKey === key) {
      setSortDir(newDir);
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    track("third_party_sorted", { sort_key: key, sort_dir: newDir });
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      onClick={() => toggleSort(field)}
      className="text-left text-xs text-vecton-dark/50 uppercase tracking-wider p-3 cursor-pointer hover:text-vecton-dark/70 select-none"
    >
      {label}
      {sortKey === field && (
        <span className="ml-1">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>
      )}
    </th>
  );

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-vecton-dark/10">
              <SortHeader label="Script" field="script_name" />
              <SortHeader label="Category" field="category" />
              <th className="text-left text-xs text-vecton-dark/50 uppercase tracking-wider p-3">
                Loading
              </th>
              <SortHeader label="LCP" field="lcp_impact" />
              <SortHeader label="CLS" field="cls_impact" />
              <SortHeader label="INP" field="inp_impact" />
              <SortHeader label="Action" field="recommendation" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, i) => (
              <tr
                key={i}
                className="border-b border-vecton-dark/5 hover:bg-white/30"
              >
                <td className="p-3">
                  <p className="text-xs text-vecton-dark/70">
                    {entry.script_name}
                  </p>
                  <p className="text-xs text-vecton-dark/50 font-mono">
                    {entry.domain}
                  </p>
                </td>
                <td className="p-3 text-xs text-vecton-dark/60">
                  {entry.category}
                </td>
                <td className="p-3 text-xs text-vecton-dark/50 font-mono">
                  {entry.loading}
                </td>
                <td className="p-3">
                  <SeverityPill severity={entry.lcp_impact} />
                </td>
                <td className="p-3">
                  <SeverityPill severity={entry.cls_impact} />
                </td>
                <td className="p-3">
                  <SeverityPill severity={entry.inp_impact} />
                </td>
                <td className="p-3">
                  <span
                    className={`text-xs px-2.5 py-1 rounded ${ACTION_COLORS[entry.recommendation] ?? ""}`}
                  >
                    {entry.recommendation.replace("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {sorted.map((entry, i) => (
          <div
            key={i}
            className="p-3 rounded-lg bg-white/50 border border-vecton-dark/10"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-vecton-dark/70 font-medium">
                {entry.script_name}
              </p>
              <span
                className={`text-xs px-2.5 py-1 rounded ${ACTION_COLORS[entry.recommendation] ?? ""}`}
              >
                {entry.recommendation.replace("_", " ")}
              </span>
            </div>
            <p className="text-xs text-vecton-dark/50 font-mono mb-2">
              {entry.domain} &middot; {entry.category}
            </p>
            {entry.trade_off && (
              <p className="text-xs text-amber-600/70 mb-2 italic">
                {entry.trade_off}
              </p>
            )}
            <div className="flex gap-2">
              <div className="text-center">
                <p className="text-[11px] text-vecton-dark/50 mb-0.5">LCP</p>
                <SeverityPill severity={entry.lcp_impact} />
              </div>
              <div className="text-center">
                <p className="text-[11px] text-vecton-dark/50 mb-0.5">CLS</p>
                <SeverityPill severity={entry.cls_impact} />
              </div>
              <div className="text-center">
                <p className="text-[11px] text-vecton-dark/50 mb-0.5">INP</p>
                <SeverityPill severity={entry.inp_impact} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
