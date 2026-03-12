"use client";

import type { Severity } from "@/lib/types";

const COLORS: Record<Severity, { bg: string; text: string }> = {
  critical: { bg: "bg-[#ff4e42]/10", text: "text-[#ff4e42]" },
  high: { bg: "bg-[#ff4e42]/8", text: "text-[#ff4e42]/80" },
  medium: { bg: "bg-[#ffa400]/10", text: "text-[#ffa400]" },
  low: { bg: "bg-[#0cce6b]/10", text: "text-[#0cce6b]" },
};

export default function SeverityPill({ severity }: { severity: Severity }) {
  const c = COLORS[severity];
  return (
    <span
      className={`text-xs px-2.5 py-1 rounded uppercase tracking-wider ${c.bg} ${c.text}`}
    >
      {severity}
    </span>
  );
}
