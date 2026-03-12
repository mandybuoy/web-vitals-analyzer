"use client";

import type { VitalRating } from "@/lib/types";

const COLORS: Record<VitalRating, { bg: string; text: string; label: string }> =
  {
    good: { bg: "bg-[#0cce6b]/10", text: "text-[#0cce6b]", label: "Good" },
    needs_improvement: {
      bg: "bg-[#ffa400]/10",
      text: "text-[#ffa400]",
      label: "Needs Work",
    },
    poor: { bg: "bg-[#ff4e42]/10", text: "text-[#ff4e42]", label: "Poor" },
  };

export default function RatingPill({ rating }: { rating: VitalRating }) {
  const c = COLORS[rating];
  return (
    <span className={`text-xs px-2.5 py-1 rounded ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
