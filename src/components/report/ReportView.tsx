"use client";

import { useState, useEffect } from "react";
import type { AnalysisReport } from "@/lib/types";
import { track } from "@/lib/analytics";
import SummaryCards from "./SummaryCards";
import ReportTabBar, { type ReportTab } from "./ReportTabBar";
import MetricTab from "./MetricTab";
import ThirdPartyTab from "./ThirdPartyTab";
import PriorityTab from "./PriorityTab";

interface ReportViewProps {
  report: AnalysisReport;
}

export default function ReportView({ report }: ReportViewProps) {
  const hasDesktop = !!report.desktop;
  const hasMobile = !!report.mobile;

  const defaultDevice = hasMobile ? "mobile" : "desktop";
  const [activeDevice, setActiveDevice] = useState<"mobile" | "desktop">(
    defaultDevice,
  );
  const [activeTab, setActiveTab] = useState<ReportTab>("inp");

  const device = activeDevice === "mobile" ? report.mobile : report.desktop;

  // Track initial tab view on mount
  useEffect(() => {
    track("report_tab_viewed", { tab: "inp", device: defaultDevice });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="mt-10 animate-fade-up"
      style={{ animationFillMode: "forwards" }}
    >
      {/* URL & timestamp */}
      <div className="mb-6">
        <p className="text-xs text-vecton-dark/60 font-mono truncate">
          {report.url}
        </p>
        <p className="text-xs text-vecton-dark/50 mt-1">
          Analyzed {new Date(report.timestamp).toLocaleString()}
        </p>
      </div>

      {/* Warnings */}
      {report.warnings.length > 0 && (
        <div className="mb-4 space-y-1">
          {report.warnings.map((w, i) => (
            <div
              key={i}
              className="text-xs text-[#ffa400] bg-[#ffa400]/8 border border-[#ffa400]/15 px-3 py-2 rounded"
            >
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Device toggle */}
      <div className="flex gap-2 mb-8">
        {(["mobile", "desktop"] as const).map((tab) => {
          const available = tab === "mobile" ? hasMobile : hasDesktop;
          const isActive = activeDevice === tab;
          const deviceReport =
            tab === "mobile" ? report.mobile : report.desktop;
          const score = deviceReport?.lab_metrics.performance_score;

          return (
            <button
              key={tab}
              onClick={() => {
                if (available) {
                  track("device_toggled", { device: tab, score });
                  setActiveDevice(tab);
                }
              }}
              disabled={!available}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all
                ${
                  isActive
                    ? "bg-vecton-orange/10 text-vecton-orange border border-vecton-orange/20"
                    : available
                      ? "bg-vecton-dark/5 text-vecton-dark/60 border border-vecton-dark/10 hover:bg-vecton-dark/8"
                      : "bg-vecton-dark/3 text-vecton-dark/20 border border-vecton-dark/5 cursor-not-allowed"
                }`}
            >
              {tab === "mobile" ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              )}
              <span className="capitalize">{tab}</span>
              {score !== undefined && (
                <span
                  className={`ml-1 text-[11px] px-1.5 py-0.5 rounded
                    ${
                      score >= 90
                        ? "bg-[#0cce6b]/10 text-[#0cce6b]"
                        : score >= 50
                          ? "bg-[#ffa400]/10 text-[#ffa400]"
                          : "bg-[#ff4e42]/10 text-[#ff4e42]"
                    }`}
                >
                  {Math.round(score)}
                </span>
              )}
              {!available && (
                <span className="text-xs text-vecton-dark/50">unavailable</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Report content */}
      {device ? (
        <>
          <SummaryCards device={device} sourceStats={report.source_stats} />

          <div className="mt-8">
            <ReportTabBar
              active={activeTab}
              onChange={(tab) => {
                track("report_tab_viewed", { tab, device: activeDevice });
                setActiveTab(tab);
              }}
            />
            <div className="p-5 sm:p-6 bg-white/20 border border-vecton-dark/10 border-t-0 rounded-b-lg min-h-[200px]">
              {activeTab === "inp" && (
                <MetricTab
                  issues={device.inp_analysis.issues}
                  metricLabel="INP"
                />
              )}
              {activeTab === "lcp" && (
                <MetricTab
                  issues={device.lcp_analysis.issues}
                  metricLabel="LCP"
                />
              )}
              {activeTab === "cls" && (
                <MetricTab
                  issues={device.cls_analysis.issues}
                  metricLabel="CLS"
                />
              )}
              {activeTab === "third-party" && (
                <ThirdPartyTab entries={device.third_party_matrix} />
              )}
              {activeTab === "priority" && (
                <PriorityTab fixes={device.priority_table} />
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="py-8 text-center text-sm text-vecton-dark/40">
          No data available for {activeDevice}
        </div>
      )}
    </div>
  );
}
