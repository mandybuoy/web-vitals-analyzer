"use client";

import type { Difficulty } from "@/lib/types";

const COLORS: Record<Difficulty, { bg: string; text: string }> = {
  easy: { bg: "bg-vital-good/10", text: "text-vital-good" },
  moderate: { bg: "bg-vital-needs/10", text: "text-vital-needs" },
  hard: { bg: "bg-vital-poor/10", text: "text-vital-poor" },
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
