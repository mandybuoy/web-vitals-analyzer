"use client";

import type { DuplicateResource } from "@/lib/types";

interface DuplicatesTabProps {
  duplicates: DuplicateResource[];
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function truncateUrl(url: string, maxLen = 60): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + "...";
}

export default function DuplicatesTab({ duplicates }: DuplicatesTabProps) {
  if (duplicates.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-vecton-dark/40">
        No duplicate resources detected on this page.
      </div>
    );
  }

  const sorted = [...duplicates].sort(
    (a, b) => b.totalTransferSize - a.totalTransferSize,
  );

  return (
    <div>
      <p className="text-xs text-vecton-dark/50 mb-4">
        These URLs were loaded multiple times on the same page. Duplicate loads
        waste bandwidth and can delay rendering.
      </p>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-vecton-dark/10">
              <th className="text-left py-2 px-2 text-vecton-dark/50 font-medium">
                URL
              </th>
              <th className="text-center py-2 px-2 text-vecton-dark/50 font-medium">
                Loads
              </th>
              <th className="text-right py-2 px-2 text-vecton-dark/50 font-medium">
                Total Size
              </th>
              <th className="text-left py-2 px-2 text-vecton-dark/50 font-medium">
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d, i) => (
              <tr
                key={i}
                className="border-b border-vecton-dark/5 hover:bg-vecton-dark/[0.02]"
              >
                <td className="py-2.5 px-2">
                  <span className="font-mono text-vecton-dark/70" title={d.url}>
                    {truncateUrl(d.url)}
                  </span>
                </td>
                <td className="py-2.5 px-2 text-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-vital-poor/10 text-vital-poor text-xs font-medium">
                    {d.count}x
                  </span>
                </td>
                <td className="py-2.5 px-2 text-right font-mono text-vecton-dark/60">
                  {formatBytes(d.totalTransferSize)}
                </td>
                <td className="py-2.5 px-2 text-vecton-dark/50">
                  {d.resourceType}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {sorted.map((d, i) => (
          <div
            key={i}
            className="p-3 rounded-lg bg-white/30 border border-vecton-dark/5"
          >
            <p
              className="text-xs font-mono text-vecton-dark/70 truncate mb-2"
              title={d.url}
            >
              {d.url}
            </p>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1 text-vital-poor">
                <span className="font-medium">{d.count}x</span> loaded
              </span>
              <span className="text-vecton-dark/50">
                {formatBytes(d.totalTransferSize)}
              </span>
              <span className="text-vecton-dark/40">{d.resourceType}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
