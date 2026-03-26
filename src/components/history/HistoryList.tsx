"use client";

import { useState } from "react";
import type { HistoryEntry, VitalRating } from "@/lib/types";
import { track } from "@/lib/analytics";
import RatingPill from "../report/RatingPill";

const PAGE_SIZE = 5;

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
  const [page, setPage] = useState(0);

  if (entries.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-vecton-dark/50">No analyses yet</p>
      </div>
    );
  }

  const totalPages = Math.ceil(entries.length / PAGE_SIZE);
  const visible = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-4 h-[1px] bg-vecton-orange/40" />
        <h3 className="text-[11px] text-vecton-dark/50 uppercase tracking-widest">
          Recent Analyses
        </h3>
        <div className="flex-1 h-[1px] bg-vecton-dark/10" />
        {totalPages > 1 && (
          <span className="text-[11px] text-vecton-dark/30">
            {page + 1}/{totalPages}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {visible.map((entry) => (
          <button
            key={entry.analysis_id}
            onClick={() => {
              track("history_item_clicked", {
                analysis_id: entry.analysis_id,
                url: entry.url,
              });
              onSelect(entry.analysis_id);
            }}
            className="w-full text-left p-3 rounded-lg bg-white/30 border border-vecton-dark/5 hover:bg-white/50 hover:border-vecton-dark/10 transition-colors focus-ring press-scale"
          >
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-vecton-dark/60 font-mono truncate max-w-[70%]">
                {entry.url}
              </p>
              <p className="text-xs text-vecton-dark/50 flex-shrink-0">
                {formatDate(entry.timestamp)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {entry.mobile_score !== null && (
                <span
                  className={`text-xs px-2 py-0.5 rounded font-mono
                    ${
                      entry.mobile_score >= 90
                        ? "bg-vital-good/10 text-vital-good"
                        : entry.mobile_score >= 50
                          ? "bg-vital-needs/10 text-vital-needs"
                          : "bg-vital-poor/10 text-vital-poor"
                    }`}
                >
                  M: {Math.round(entry.mobile_score)}
                </span>
              )}
              {entry.desktop_score !== null && (
                <span
                  className={`text-xs px-2 py-0.5 rounded font-mono
                    ${
                      entry.desktop_score >= 90
                        ? "bg-vital-good/10 text-vital-good"
                        : entry.desktop_score >= 50
                          ? "bg-vital-needs/10 text-vital-needs"
                          : "bg-vital-poor/10 text-vital-poor"
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs px-3 py-1.5 rounded border border-vecton-dark/10 text-vecton-dark/50 hover:bg-vecton-dark/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-ring"
          >
            Prev
          </button>
          <span className="text-xs text-vecton-dark/40 font-mono">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-xs px-3 py-1.5 rounded border border-vecton-dark/10 text-vecton-dark/50 hover:bg-vecton-dark/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-ring"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
