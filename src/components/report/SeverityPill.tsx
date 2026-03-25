"use client";

import type { Severity } from "@/lib/types";

const COLORS: Record<Severity, { bg: string; text: string }> = {
  critical: { bg: "bg-vital-poor/10", text: "text-vital-poor" },
  high: { bg: "bg-vital-poor/8", text: "text-vital-poor/80" },
  medium: { bg: "bg-vital-needs/10", text: "text-vital-needs" },
  low: { bg: "bg-vital-good/10", text: "text-vital-good" },
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
