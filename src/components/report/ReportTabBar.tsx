"use client";

export type ReportTab = "inp" | "lcp" | "cls" | "third-party" | "priority";

const TABS: { id: ReportTab; label: string }[] = [
  { id: "inp", label: "INP" },
  { id: "lcp", label: "LCP" },
  { id: "cls", label: "CLS" },
  { id: "third-party", label: "Third-Party" },
  { id: "priority", label: "Priority" },
];

interface ReportTabBarProps {
  active: ReportTab;
  onChange: (tab: ReportTab) => void;
}

export default function ReportTabBar({ active, onChange }: ReportTabBarProps) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 -mb-px">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-4 py-2 text-xs uppercase tracking-wider rounded-t-lg border border-b-0 transition-colors whitespace-nowrap
              ${
                isActive
                  ? "bg-white/50 text-vecton-dark border-vecton-dark/10 font-medium"
                  : "bg-transparent text-vecton-dark/40 border-transparent hover:text-vecton-dark/60"
              }
              ${tab.id === "inp" && !isActive ? "text-vecton-purple/60" : ""}
            `}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
