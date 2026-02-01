'use client';

import { PSIResult } from '@/lib/psi';
import ScoreGauge from './ScoreGauge';
import MetricCard from './MetricCard';
import AnalysisReport from './AnalysisReport';
import { useState } from 'react';

interface DashboardProps {
  mobile: PSIResult;
  desktop: PSIResult;
  analysis: string;
  isAnalyzing: boolean;
}

export default function Dashboard({ mobile, desktop, analysis, isAnalyzing }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'mobile' | 'desktop'>('mobile');
  const [showLabData, setShowLabData] = useState(false);
  const activeResult = activeTab === 'mobile' ? mobile : desktop;
  const metrics = Object.values(activeResult.metrics);

  return (
    <div className="mt-10 animate-fade-up" style={{ animationFillMode: 'forwards' }}>
      {/* URL & timestamp */}
      <div className="mb-6">
        <p className="text-[11px] text-vecton-beige/30 font-mono truncate">{activeResult.url}</p>
        <p className="text-[11px] text-vecton-beige/20 mt-1">
          Analyzed {new Date(activeResult.fetchTime).toLocaleString()}
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 mb-8">
        {(['mobile', 'desktop'] as const).map((tab) => {
          const result = tab === 'mobile' ? mobile : desktop;
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setShowLabData(false);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all
                ${isActive
                  ? 'bg-vecton-orange/10 text-vecton-orange border border-vecton-orange/20'
                  : 'bg-vecton-beige/3 text-vecton-beige/40 border border-vecton-beige/8 hover:bg-vecton-beige/5'
                }`}
            >
              {tab === 'mobile' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
              )}
              <span className="capitalize">{tab}</span>
              <span className={`ml-1 text-[11px] px-1.5 py-0.5 rounded
                ${result.overallScore >= 90 ? 'bg-[#0cce6b]/10 text-[#0cce6b]' :
                  result.overallScore >= 50 ? 'bg-[#ffa400]/10 text-[#ffa400]' :
                  'bg-[#ff4e42]/10 text-[#ff4e42]'}`}>
                {Math.round(result.overallScore)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Overall score + Core Vitals gauges */}
      <div className="relative grid grid-cols-4 gap-6 mb-10 p-6 rounded-lg bg-vecton-dark border border-vecton-beige/6 focus-arrow">
        <ScoreGauge score={activeResult.overallScore} size={140} label="Performance" />
        <ScoreGauge score={activeResult.metrics.lcp.score * 100} size={110} label="LCP" />
        <ScoreGauge score={activeResult.metrics.cls.score * 100} size={110} label="CLS" />
        <ScoreGauge
          score={(activeResult.metrics.inp?.score ?? activeResult.metrics.tbt.score) * 100}
          size={110}
          label="INP"
        />
      </div>

      {/* Field Data (Real User Data) */}
      {activeResult.fieldData && Object.keys(activeResult.fieldData).some(key => activeResult.fieldData?.[key as keyof typeof activeResult.fieldData]) && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-4 h-[1px] bg-vecton-orange/40" />
            <h3 className="text-[11px] text-vecton-beige/50 uppercase tracking-widest">
              Real User Data (CrUX - 28 Days)
            </h3>
            <div className="flex-1 h-[1px] bg-vecton-beige/6" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {activeResult.fieldData.lcp && (
              <div className="p-4 rounded-lg bg-vecton-beige/3 border border-vecton-beige/6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-vecton-beige/50 uppercase tracking-wider">LCP</span>
                  <span className={`text-xs px-2 py-0.5 rounded
                    ${activeResult.fieldData.lcp.category === 'FAST' ? 'bg-[#0cce6b]/10 text-[#0cce6b]' :
                      activeResult.fieldData.lcp.category === 'AVERAGE' ? 'bg-[#ffa400]/10 text-[#ffa400]' :
                      'bg-[#ff4e42]/10 text-[#ff4e42]'}`}>
                    {activeResult.fieldData.lcp.category}
                  </span>
                </div>
                <p className="text-xl text-vecton-beige font-mono">{(activeResult.fieldData.lcp.percentile / 1000).toFixed(2)}s</p>
                <p className="text-[10px] text-vecton-beige/30 mt-1">75th percentile</p>
              </div>
            )}
            {activeResult.fieldData.inp && (
              <div className="p-4 rounded-lg bg-vecton-beige/3 border border-vecton-beige/6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-vecton-beige/50 uppercase tracking-wider">INP</span>
                  <span className={`text-xs px-2 py-0.5 rounded
                    ${activeResult.fieldData.inp.category === 'FAST' ? 'bg-[#0cce6b]/10 text-[#0cce6b]' :
                      activeResult.fieldData.inp.category === 'AVERAGE' ? 'bg-[#ffa400]/10 text-[#ffa400]' :
                      'bg-[#ff4e42]/10 text-[#ff4e42]'}`}>
                    {activeResult.fieldData.inp.category}
                  </span>
                </div>
                <p className="text-xl text-vecton-beige font-mono">{activeResult.fieldData.inp.percentile}ms</p>
                <p className="text-[10px] text-vecton-beige/30 mt-1">75th percentile</p>
              </div>
            )}
            {activeResult.fieldData.cls && (
              <div className="p-4 rounded-lg bg-vecton-beige/3 border border-vecton-beige/6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-vecton-beige/50 uppercase tracking-wider">CLS</span>
                  <span className={`text-xs px-2 py-0.5 rounded
                    ${activeResult.fieldData.cls.category === 'FAST' ? 'bg-[#0cce6b]/10 text-[#0cce6b]' :
                      activeResult.fieldData.cls.category === 'AVERAGE' ? 'bg-[#ffa400]/10 text-[#ffa400]' :
                      'bg-[#ff4e42]/10 text-[#ff4e42]'}`}>
                    {activeResult.fieldData.cls.category}
                  </span>
                </div>
                <p className="text-xl text-vecton-beige font-mono">{(activeResult.fieldData.cls.percentile / 100).toFixed(3)}</p>
                <p className="text-[10px] text-vecton-beige/30 mt-1">75th percentile</p>
              </div>
            )}
            {activeResult.fieldData.fcp && (
              <div className="p-4 rounded-lg bg-vecton-beige/3 border border-vecton-beige/6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-vecton-beige/50 uppercase tracking-wider">FCP</span>
                  <span className={`text-xs px-2 py-0.5 rounded
                    ${activeResult.fieldData.fcp.category === 'FAST' ? 'bg-[#0cce6b]/10 text-[#0cce6b]' :
                      activeResult.fieldData.fcp.category === 'AVERAGE' ? 'bg-[#ffa400]/10 text-[#ffa400]' :
                      'bg-[#ff4e42]/10 text-[#ff4e42]'}`}>
                    {activeResult.fieldData.fcp.category}
                  </span>
                </div>
                <p className="text-xl text-vecton-beige font-mono">{(activeResult.fieldData.fcp.percentile / 1000).toFixed(2)}s</p>
                <p className="text-[10px] text-vecton-beige/30 mt-1">75th percentile</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Lab Data (Collapsible) */}
      <div className="mb-8">
        <button
          onClick={() => setShowLabData(!showLabData)}
          className="flex items-center gap-3 w-full mb-4 hover:opacity-70 transition-opacity"
        >
          <div className="w-4 h-[1px] bg-vecton-orange/40" />
          <h3 className="text-[11px] text-vecton-beige/50 uppercase tracking-widest">
            Lab Data (Simulated Test)
          </h3>
          <svg
            className={`w-3 h-3 text-vecton-beige/50 transition-transform ${showLabData ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <div className="flex-1 h-[1px] bg-vecton-beige/6" />
        </button>
        {showLabData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-fade-up">
            {metrics.map((metric, i) => (
              <MetricCard key={metric.shortName} metric={metric} delay={i * 80} />
            ))}
          </div>
        )}
      </div>

      {/* Opportunities */}
      {activeResult.opportunities.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-4 h-[1px] bg-vecton-orange/40" />
            <h3 className="text-[11px] text-vecton-beige/50 uppercase tracking-widest">
              Opportunities
            </h3>
            <div className="flex-1 h-[1px] bg-vecton-beige/6" />
          </div>
          <div className="space-y-2">
            {activeResult.opportunities.map((opp) => (
              <div
                key={opp.id}
                className="flex items-center justify-between p-3 rounded-lg bg-vecton-beige/3 border border-vecton-beige/6"
              >
                <p className="text-sm text-vecton-beige/70">{opp.title}</p>
                {opp.savings && (
                  <span className="text-[11px] text-vecton-orange bg-vecton-orange/8 px-2 py-1 rounded ml-3 whitespace-nowrap">
                    {opp.savings}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Analysis */}
      <AnalysisReport analysis={analysis} isLoading={isAnalyzing} />
    </div>
  );
}
