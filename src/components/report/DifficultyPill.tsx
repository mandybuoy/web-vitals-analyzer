"use client";

import type { Difficulty } from "@/lib/types";

const COLORS: Record<Difficulty, { bg: string; text: string }> = {
  easy: { bg: "bg-[#0cce6b]/10", text: "text-[#0cce6b]" },
  moderate: { bg: "bg-[#ffa400]/10", text: "text-[#ffa400]" },
  hard: { bg: "bg-[#ff4e42]/10", text: "text-[#ff4e42]" },
};

export default function DifficultyPill({
  difficulty,
}: {
  difficulty: Difficulty;
}) {
  const c = COLORS[difficulty];
  return (
    <span
      className={`text-xs px-2.5 py-1 rounded uppercase tracking-wider ${c.bg} ${c.text}`}
    >
      {difficulty}
    </span>
  );
}
