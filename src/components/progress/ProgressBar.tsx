"use client";

import type {
  PipelineStatus,
  StageTimestamps,
  SubStageStatus,
} from "@/lib/types";
import { useElapsedTime } from "@/hooks/useElapsedTime";

interface ProgressBarProps {
  status: PipelineStatus;
  onCancel: () => void;
}

const STAGES = [
  { num: 1, name: "Collecting", desc: "PSI + HTML" },
  { num: 2, name: "Extracting", desc: "HTML signals" },
  { num: 3, name: "Analyzing", desc: "Deep analysis" },
  { num: 4, name: "Generating", desc: "Report" },
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
          <span className="text-xs font-mono">{num}</span>
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
                : "text-vecton-dark/50"
          }`}
        >
          {name}
        </p>
        <p className="text-xs text-vecton-dark/50 truncate">{desc}</p>
        {(state === "completed" || state === "active") && elapsed > 0 && (
          <p className="text-xs text-vecton-dark/50 font-mono">{elapsed}s</p>
        )}
      </div>
    </div>
  );
}

function SubTaskRow({
  label,
  status,
  startTime,
  endTime,
}: {
  label: string;
  status: SubStageStatus;
  startTime?: string;
  endTime?: string;
}) {
  const elapsed = useElapsedTime(startTime, endTime);

  return (
    <div className="flex items-center gap-2">
      {/* Status icon */}
      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
        {status === "done" ? (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0cce6b"
            strokeWidth="3"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : status === "running" ? (
          <div className="w-2 h-2 rounded-full bg-vecton-orange animate-progress-pulse" />
        ) : status === "failed" ? (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ff4e42"
            strokeWidth="3"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-vecton-dark/20" />
        )}
      </div>
      {/* Label + time */}
      <span
        className={`text-xs font-mono ${
          status === "running"
            ? "text-vecton-orange"
            : status === "done"
              ? "text-vecton-dark/60"
              : status === "failed"
                ? "text-[#ff4e42]/70"
                : "text-vecton-dark/40"
        }`}
      >
        {label}
      </span>
      {(status === "running" || status === "done") && elapsed > 0 && (
        <span className="text-xs text-vecton-dark/50 font-mono">
          {elapsed}s
        </span>
      )}
    </div>
  );
}

function CollectionSplitView({ status }: { status: PipelineStatus }) {
  const cp = status.collection_progress;
  if (!cp) return null;

  return (
    <div className="grid grid-cols-2 gap-4 mb-4 p-3 rounded bg-vecton-dark/[0.03] border border-vecton-dark/5">
      {/* PSI side */}
      <div>
        <p className="text-xs text-vecton-dark/50 uppercase tracking-wider mb-2">
          Google PSI
        </p>
        <div className="space-y-1.5">
          <SubTaskRow
            label="Desktop"
            status={cp.psi_desktop}
            startTime={cp.psi_desktop_start}
            endTime={cp.psi_desktop_end}
          />
          <SubTaskRow
            label="Mobile"
            status={cp.psi_mobile}
            startTime={cp.psi_mobile_start}
            endTime={cp.psi_mobile_end}
          />
        </div>
        {cp.psi_detail && (
          <p className="text-[11px] text-vecton-orange/60 font-mono mt-1.5 animate-pulse">
            {cp.psi_detail}
          </p>
        )}
      </div>

      {/* HTML side */}
      <div className="border-l border-vecton-dark/8 pl-4">
        <p className="text-xs text-vecton-dark/50 uppercase tracking-wider mb-2">
          HTML Analysis
        </p>
        <div className="space-y-1.5">
          <SubTaskRow
            label="Fetch"
            status={cp.html_fetch}
            startTime={cp.html_fetch_start}
            endTime={cp.html_fetch_end}
          />
          <SubTaskRow
            label="Extract"
            status={cp.html_extract}
            startTime={cp.html_extract_start}
            endTime={cp.html_extract_end}
          />
        </div>
      </div>
    </div>
  );
}

export default function ProgressBar({ status, onCancel }: ProgressBarProps) {
  const currentStage = status.stage;
  const stages = STAGES;
  const totalStages = stages.length;

  // Global progress: completed stages + fraction of current stage
  const globalProgress = Math.min(
    100,
    ((currentStage - 1) / totalStages) * 100 +
      status.progress_pct / totalStages,
  );

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

        {/* Collection split view (Stage 1 only) */}
        {currentStage === 1 && status.collection_progress && (
          <CollectionSplitView status={status} />
        )}

        {/* Global progress bar */}
        <div className="w-full bg-vecton-dark/10 rounded-full h-1.5 mb-3">
          <div
            className="bg-vecton-orange h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${globalProgress}%` }}
          />
        </div>

        {/* Detail / retry info */}
        {status.detail && (
          <p className="text-xs text-vecton-orange/70 font-mono mb-2 animate-pulse">
            {status.detail}
          </p>
        )}

        {/* Cancel button */}
        <div className="flex justify-end items-center">
          <button
            onClick={onCancel}
            className="text-xs text-[#ff4e42]/60 hover:text-[#ff4e42] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
