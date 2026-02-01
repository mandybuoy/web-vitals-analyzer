'use client';

import { useState } from 'react';

interface AnalysisReportProps {
  analysis: string;
  isLoading?: boolean;
}

function renderMarkdown(text: string): string {
  let html = text
    .replace(/^### (.+)$/gm, '<h3 class="text-sm text-vecton-dark mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base text-vecton-dark mt-6 mb-3 pb-2 border-b border-vecton-dark/10">$2</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg text-vecton-dark mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-vecton-dark">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-vecton-dark/70">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-vecton-orange/10 text-vecton-orange rounded text-[11px] font-mono">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="text-vecton-dark/60 text-sm ml-4 mb-1 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="text-vecton-dark/60 text-sm ml-4 mb-1 list-decimal" value="$1">$2</li>')
    .replace(/\n\n/g, '</p><p class="text-vecton-dark/60 text-sm leading-brand mb-3">')
    .replace(/\n/g, '<br />');

  return `<p class="text-vecton-dark/60 text-sm leading-brand mb-3">${html}</p>`;
}

export default function AnalysisReport({ analysis, isLoading }: AnalysisReportProps) {
  const [expanded, setExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="relative rounded-lg border border-vecton-purple/20 bg-vecton-purple/5 p-6 mt-8 focus-arrow">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-2 rounded-full bg-vecton-purple animate-pulse" />
          <div>
            <h3 className="text-vecton-dark text-sm">AI Analysis</h3>
            <p className="text-[11px] text-vecton-dark/40">Claude is analyzing your results...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-2.5 bg-vecton-dark/5 rounded w-full mb-2" />
              <div className="h-2.5 bg-vecton-dark/3 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div
      className="relative rounded-lg border border-vecton-purple/20 bg-vecton-purple/5 p-6 mt-8 focus-arrow opacity-0 animate-fade-up"
      style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full mb-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-vecton-purple" />
          <div className="text-left">
            <h3 className="text-vecton-dark text-sm">AI Performance Analysis</h3>
            <p className="text-[11px] text-vecton-dark/40">Powered by Claude</p>
          </div>
        </div>
        <span className="text-vecton-dark/40 text-xs">
          {expanded ? '▲ Collapse' : '▼ Expand'}
        </span>
      </button>

      {expanded && (
        <div
          className="max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(analysis) }}
        />
      )}
    </div>
  );
}
