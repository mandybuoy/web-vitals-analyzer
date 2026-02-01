'use client';

import { MetricData } from '@/lib/psi';

interface MetricCardProps {
  metric: MetricData;
  delay?: number;
}

const ratingStyles = {
  good: { bg: 'bg-[#0cce6b]/8', border: 'border-[#0cce6b]/15', text: 'text-[#0cce6b]', dot: 'bg-[#0cce6b]' },
  'needs-improvement': { bg: 'bg-[#ffa400]/8', border: 'border-[#ffa400]/15', text: 'text-[#ffa400]', dot: 'bg-[#ffa400]' },
  poor: { bg: 'bg-[#ff4e42]/8', border: 'border-[#ff4e42]/15', text: 'text-[#ff4e42]', dot: 'bg-[#ff4e42]' },
};

const coreVitals = ['LCP', 'INP', 'CLS'];

export default function MetricCard({ metric, delay = 0 }: MetricCardProps) {
  const s = ratingStyles[metric.rating];
  const isCore = coreVitals.includes(metric.shortName);

  return (
    <div
      className={`relative rounded-lg border ${s.border} ${s.bg} p-4 
        transition-all duration-300 hover:scale-[1.02]
        opacity-0 animate-fade-up`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      {isCore && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-vecton-orange/90 rounded text-[9px] uppercase tracking-widest text-vecton-light">
          Core
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            <span className="text-sm text-vecton-dark">{metric.shortName}</span>
          </div>
          <p className="text-[11px] text-vecton-dark/40 mt-0.5">{metric.name}</p>
        </div>
        <div className="text-right">
          <span className={`text-lg ${s.text}`} style={{ lineHeight: '110%' }}>
            {metric.displayValue}
          </span>
          <p className="text-[10px] text-vecton-dark/30 uppercase tracking-wider">
            Score: {(metric.score * 100).toFixed(0)}
          </p>
        </div>
      </div>
      <p className="text-[11px] text-vecton-dark/35 leading-brand">{metric.description}</p>
    </div>
  );
}
