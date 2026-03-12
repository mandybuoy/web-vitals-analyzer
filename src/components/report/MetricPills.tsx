"use client";

import type { MetricName } from "@/lib/types";

const COLORS: Record<MetricName, string> = {
  INP: "bg-vecton-purple/10 text-vecton-purple",
  LCP: "bg-vecton-orange/10 text-vecton-orange",
  CLS: "bg-blue-500/10 text-blue-600",
};

export default function MetricPills({ metrics }: { metrics: MetricName[] }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {metrics.map((m) => (
        <span
          key={m}
          className={`text-xs px-2 py-0.5 rounded font-mono ${COLORS[m]}`}
        >
          {m}
        </span>
      ))}
    </div>
  );
}
