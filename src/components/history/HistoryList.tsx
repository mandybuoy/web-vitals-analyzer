"use client";

import type { HistoryEntry, VitalRating } from "@/lib/types";
import RatingPill from "../report/RatingPill";

interface HistoryListProps {
  entries: HistoryEntry[];
  onSelect: (id: string) => void;
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function RatingDot({ rating }: { rating: VitalRating | null }) {
  if (!rating) return null;
  return <RatingPill rating={rating} />;
}

export default function HistoryList({ entries, onSelect }: HistoryListProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-vecton-dark/30">No analyses yet</p>
      </div>
    );
  }

  const visible = entries.slice(0, 10);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-4 h-[1px] bg-vecton-orange/40" />
        <h3 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest">
          Recent Analyses
        </h3>
        <div className="flex-1 h-[1px] bg-vecton-dark/10" />
      </div>
      <div className="space-y-2">
        {visible.map((entry) => (
          <button
            key={entry.analysis_id}
            onClick={() => onSelect(entry.analysis_id)}
            className="w-full text-left p-3 rounded-lg bg-white/30 border border-vecton-dark/5 hover:bg-white/50 hover:border-vecton-dark/10 transition-colors"
          >
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-vecton-dark/60 font-mono truncate max-w-[70%]">
                {entry.url}
              </p>
              <p className="text-[10px] text-vecton-dark/30 flex-shrink-0">
                {formatDate(entry.timestamp)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {entry.mobile_score !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono
                    ${
                      entry.mobile_score >= 90
                        ? "bg-[#0cce6b]/10 text-[#0cce6b]"
                        : entry.mobile_score >= 50
                          ? "bg-[#ffa400]/10 text-[#ffa400]"
                          : "bg-[#ff4e42]/10 text-[#ff4e42]"
                    }`}
                >
                  M: {Math.round(entry.mobile_score)}
                </span>
              )}
              {entry.desktop_score !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono
                    ${
                      entry.desktop_score >= 90
                        ? "bg-[#0cce6b]/10 text-[#0cce6b]"
                        : entry.desktop_score >= 50
                          ? "bg-[#ffa400]/10 text-[#ffa400]"
                          : "bg-[#ff4e42]/10 text-[#ff4e42]"
                    }`}
                >
                  D: {Math.round(entry.desktop_score)}
                </span>
              )}
              <div className="flex gap-1 ml-auto">
                <RatingDot rating={entry.mobile_lcp_rating} />
                <RatingDot rating={entry.mobile_inp_rating} />
                <RatingDot rating={entry.mobile_cls_rating} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
