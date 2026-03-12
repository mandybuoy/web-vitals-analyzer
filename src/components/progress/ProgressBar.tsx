"use client";

import type { PipelineStatus, StageTimestamps } from "@/lib/types";
import { useElapsedTime } from "@/hooks/useElapsedTime";

interface ProgressBarProps {
  status: PipelineStatus;
  onCancel: () => void;
  psiOnly?: boolean;
}

const STAGES = [
  { num: 1, name: "Collecting", desc: "PSI + HTML" },
  { num: 2, name: "Extracting", desc: "HTML signals" },
  { num: 3, name: "Analyzing", desc: "Deep analysis" },
  { num: 4, name: "Generating", desc: "Report" },
] as const;

const PSI_STAGES = [
  { num: 1, name: "Collecting", desc: "PSI + HTML" },
  { num: 2, name: "Processing", desc: "Extracting signals" },
] as const;

function StageStep({
  num,
  name,
  desc,
  state,
  timestamps,
}: {
  num: number;
  name: string;
  desc: string;
  state: "completed" | "active" | "pending";
  timestamps: StageTimestamps;
}) {
  const startKey = `stage_${num}_start` as keyof StageTimestamps;
  const endKey = `stage_${num}_end` as keyof StageTimestamps;
  const elapsed = useElapsedTime(timestamps[startKey], timestamps[endKey]);

  return (
    <div className="flex items-center gap-3 min-w-0">
      {/* Circle */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors
          ${
            state === "completed"
              ? "bg-vecton-orange text-white"
              : state === "active"
                ? "bg-vecton-orange/20 border-2 border-vecton-orange"
                : "bg-vecton-dark/10 text-vecton-dark/30"
          }`}
      >
        {state === "completed" ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : state === "active" ? (
          <div className="w-2.5 h-2.5 rounded-full bg-vecton-orange animate-progress-pulse" />
        ) : (
          <span className="text-[10px] font-mono">{num}</span>
        )}
      </div>

      {/* Text */}
      <div className="min-w-0">
        <p
          className={`text-xs truncate ${
            state === "active"
              ? "text-vecton-orange font-medium"
              : state === "completed"
                ? "text-vecton-dark/70"
                : "text-vecton-dark/30"
          }`}
        >
          {name}
        </p>
        <p className="text-[10px] text-vecton-dark/40 truncate">{desc}</p>
        {(state === "completed" || state === "active") && elapsed > 0 && (
          <p className="text-[10px] text-vecton-dark/30 font-mono">
            {elapsed}s
          </p>
        )}
      </div>
    </div>
  );
}

export default function ProgressBar({
  status,
  onCancel,
  psiOnly,
}: ProgressBarProps) {
  const currentStage = status.stage;
  const stages = psiOnly ? PSI_STAGES : STAGES;

  return (
    <div className="animate-fade-up">
      <div className="p-6 rounded-lg bg-white/50 border border-vecton-dark/10">
        {/* Horizontal steps (desktop) */}
        <div className="hidden sm:flex items-center justify-between gap-4 mb-4">
          {stages.map((stage, i) => (
            <div key={stage.num} className="flex items-center gap-4 flex-1">
              <StageStep
                num={stage.num}
                name={stage.name}
                desc={stage.desc}
                state={
                  currentStage > stage.num || status.progress_pct >= 100
                    ? "completed"
                    : currentStage === stage.num
                      ? "active"
                      : "pending"
                }
                timestamps={status.stage_timestamps}
              />
              {i < stages.length - 1 && (
                <div
                  className={`flex-1 h-[1px] ${
                    currentStage > stage.num
                      ? "bg-vecton-orange"
                      : "bg-vecton-dark/10"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Vertical steps (mobile) */}
        <div className="sm:hidden space-y-3 mb-4">
          {stages.map((stage) => (
            <StageStep
              key={stage.num}
              num={stage.num}
              name={stage.name}
              desc={stage.desc}
              state={
                currentStage > stage.num || status.progress_pct >= 100
                  ? "completed"
                  : currentStage === stage.num
                    ? "active"
                    : "pending"
              }
              timestamps={status.stage_timestamps}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-vecton-dark/10 rounded-full h-1.5 mb-3">
          <div
            className="bg-vecton-orange h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${status.progress_pct}%` }}
          />
        </div>

        {/* Detail / retry info */}
        {status.detail && (
          <p className="text-[10px] text-vecton-orange/70 font-mono mb-2 animate-pulse">
            {status.detail}
          </p>
        )}

        {/* Cancel button */}
        <div className="flex justify-end items-center">
          <button
            onClick={onCancel}
            className="text-[11px] text-[#ff4e42]/60 hover:text-[#ff4e42] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
