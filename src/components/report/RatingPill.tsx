"use client";

import type { VitalRating } from "@/lib/types";

const COLORS: Record<VitalRating, { bg: string; text: string; label: string }> =
  {
    good: { bg: "bg-vital-good/10", text: "text-vital-good", label: "Good" },
    needs_improvement: {
      bg: "bg-vital-needs/10",
      text: "text-vital-needs",
      label: "Needs Work",
    },
    poor: { bg: "bg-vital-poor/10", text: "text-vital-poor", label: "Poor" },
  };

export default function RatingPill({ rating }: { rating: VitalRating }) {
  const c = COLORS[rating];
  return (
    <span className={`text-xs px-2.5 py-1 rounded ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
