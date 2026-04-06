"use client";

import { useState, useRef } from "react";
import type { HistoryEntry, VitalRating, AnalysisReport } from "@/lib/types";
import { track } from "@/lib/analytics";
import * as api from "@/lib/api";
import RatingPill from "../report/RatingPill";
import ComparisonView from "./ComparisonView";

const PAGE_SIZE = 10;

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
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareData, setCompareData] = useState<{
    reportA: AnalysisReport;
    reportB: AnalysisReport;
  } | null>(null);
  const compareRef = useRef<HTMLDivElement>(null);

  if (entries.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-vecton-dark/50">No analyses yet</p>
      </div>
    );
  }

  // Filter by search, then sort selected to top
  const filtered = search
    ? entries.filter((e) => e.url.toLowerCase().includes(search.toLowerCase()))
    : entries;

  const sorted = [...filtered].sort((a, b) => {
    const aSelected = selected.has(a.analysis_id) ? 0 : 1;
    const bSelected = selected.has(b.analysis_id) ? 0 : 1;
    return aSelected - bSelected;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const visible = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 2) {
        next.add(id);
      } else {
        // Replace oldest selection
        const first = next.values().next().value;
        if (first) next.delete(first);
        next.add(id);
      }
      return next;
    });
  };

  const handleCompare = async () => {
    const ids = Array.from(selected);
    if (ids.length !== 2) return;
    setCompareLoading(true);
    try {
      const [reportA, reportB] = await Promise.all([
        api.getReport(ids[0]),
        api.getReport(ids[1]),
      ]);
      setCompareData({ reportA, reportB });
      // Scroll to comparison after render
      setTimeout(() => {
        compareRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
      track("comparison_opened", {
        id_a: ids[0],
        id_b: ids[1],
      });
    } catch {
      // Non-fatal
    } finally {
      setCompareLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header + search */}
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

      {/* Search input */}
      <div className="relative mb-3">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-vecton-dark/30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Filter by URL..."
          className="w-full bg-white/50 border border-vecton-dark/10 rounded-lg pl-8 pr-3 py-2 text-xs font-mono text-vecton-dark/70 placeholder-vecton-dark/30 focus:outline-none focus:border-vecton-orange/30 transition-colors"
        />
      </div>

      {/* Selection count + Compare button */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <span className="text-xs text-vecton-dark/50">
            {selected.size}/2 selected
          </span>
          {selected.size === 2 && (
            <button
              onClick={handleCompare}
              disabled={compareLoading}
              className="px-4 py-2 bg-vecton-orange text-vecton-light text-xs rounded-lg hover:bg-vecton-orange/90 disabled:opacity-50 transition-colors press-scale focus-ring flex items-center gap-2"
            >
              {compareLoading ? (
                <>
                  <svg
                    className="w-3 h-3 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray="32"
                      strokeLinecap="round"
                    />
                  </svg>
                  Loading...
                </>
              ) : (
                "Compare Selected"
              )}
            </button>
          )}
          {selected.size === 1 && (
            <span className="text-[11px] text-vecton-dark/30 italic">
              Select one more to compare
            </span>
          )}
        </div>
      )}

      {/* History items */}
      <div className="space-y-2">
        {visible.map((entry) => {
          const isSelected = selected.has(entry.analysis_id);
          return (
            <div
              key={entry.analysis_id}
              className={`flex items-center gap-2 rounded-lg border transition-colors ${
                isSelected
                  ? "bg-vecton-orange/5 border-vecton-orange/15"
                  : "bg-white/30 border-vecton-dark/5 hover:bg-white/50 hover:border-vecton-dark/10"
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelect(entry.analysis_id);
                }}
                className="ml-3 flex-shrink-0 focus-ring"
              >
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-vecton-orange border-vecton-orange"
                      : "border-vecton-dark/20 hover:border-vecton-dark/40"
                  }`}
                >
                  {isSelected && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </button>

              {/* Entry content (clickable to load report) */}
              <button
                onClick={() => {
                  track("history_item_clicked", {
                    analysis_id: entry.analysis_id,
                    url: entry.url,
                  });
                  onSelect(entry.analysis_id);
                }}
                className="flex-1 text-left p-3 focus-ring"
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
                      className={`text-xs px-2 py-0.5 rounded font-mono ${
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
                      className={`text-xs px-2 py-0.5 rounded font-mono ${
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
            </div>
          );
        })}
      </div>

      {/* No results */}
      {filtered.length === 0 && search && (
        <p className="text-xs text-vecton-dark/40 text-center py-4">
          No analyses matching &ldquo;{search}&rdquo;
        </p>
      )}

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

      {/* Comparison view */}
      {compareData && (
        <div ref={compareRef}>
          <ComparisonView
            reportA={compareData.reportA}
            reportB={compareData.reportB}
            onClose={() => {
              setCompareData(null);
              setSelected(new Set());
            }}
          />
        </div>
      )}
    </div>
  );
}
