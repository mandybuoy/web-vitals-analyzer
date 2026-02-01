'use client';

import { useState } from 'react';
import Dashboard from '@/components/Dashboard';
import { PSIResult } from '@/lib/psi';

type AppState = 'idle' | 'fetching' | 'analyzing' | 'done' | 'error';

export default function Home() {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<AppState>('idle');
  const [error, setError] = useState('');
  const [mobile, setMobile] = useState<PSIResult | null>(null);
  const [desktop, setDesktop] = useState<PSIResult | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!url.trim()) return;

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    setError('');
    setState('fetching');
    setMobile(null);
    setDesktop(null);
    setAnalysis('');

    try {
      const psiResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      if (!psiResponse.ok) {
        const errData = await psiResponse.json();
        throw new Error(errData.error || 'Failed to fetch PageSpeed data');
      }

      const psiData = await psiResponse.json();
      setMobile(psiData.mobile);
      setDesktop(psiData.desktop);
      setState('analyzing');
      setIsAnalyzing(true);

      const analysisResponse = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: psiData.mobile, desktop: psiData.desktop }),
      });

      if (!analysisResponse.ok) {
        setIsAnalyzing(false);
        setState('done');
        return;
      }

      const analysisData = await analysisResponse.json();
      setAnalysis(analysisData.analysis);
      setIsAnalyzing(false);
      setState('done');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setState('error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && state !== 'fetching' && state !== 'analyzing') {
      handleAnalyze();
    }
  };

  return (
    <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          {/* Vecton arrow accent */}
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-5 h-[1px] bg-vecton-orange/60" />
            <span className="text-[11px] text-vecton-orange uppercase tracking-[0.2em]">
              Web Vitals Analysis
            </span>
            <div className="w-5 h-[1px] bg-vecton-orange/60" />
          </div>

          <h1 className="text-4xl sm:text-5xl text-vecton-dark leading-brand tracking-tight mb-4">
            Vital<span className="text-vecton-orange">Scan</span>
          </h1>
          <p className="text-vecton-dark/60 max-w-md mx-auto text-sm leading-brand">
            Paste any URL. Get a full Core Web Vitals audit with
            AI-powered recommendations for performance.
          </p>
        </div>

        {/* Search input */}
        <div className="relative max-w-2xl mx-auto mb-8">
          <div className="relative flex items-center bg-vecton-dark border border-vecton-beige/10 rounded-lg overflow-hidden focus-within:border-vecton-orange/30 transition-colors">
            {/* Search icon */}
            <svg className="w-4 h-4 text-white/60 ml-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter URL to analyze (e.g., example.com)"
              className="flex-1 bg-transparent text-white placeholder-white/50 px-4 py-4 text-sm font-mono focus:outline-none"
              disabled={state === 'fetching'}
            />
            <button
              onClick={handleAnalyze}
              disabled={!url.trim() || state === 'fetching' || state === 'analyzing'}
              className="mr-2 px-5 py-2.5 bg-vecton-orange hover:bg-vecton-orange/90 disabled:bg-vecton-beige/8 disabled:text-vecton-beige/20 text-vecton-light text-sm rounded-md transition-all flex items-center gap-2"
            >
              {state === 'fetching' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" /></svg>
                  Scanning...
                </>
              ) : state === 'analyzing' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" /></svg>
                  Analyzing...
                </>
              ) : (
                <>
                  {/* Vecton-style arrow */}
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                  Analyze
                </>
              )}
            </button>
          </div>
        </div>

        {/* Loading state */}
        {state === 'fetching' && (
          <div className="text-center py-16 animate-fade-up">
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-lg bg-vecton-dark border border-vecton-beige/8">
              <svg className="w-4 h-4 text-vecton-orange animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
              </svg>
              <div className="text-left">
                <p className="text-sm text-white">Running PageSpeed Insights</p>
                <p className="text-[11px] text-white/50">Testing mobile &amp; desktop — 15-30 seconds...</p>
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <div className="max-w-2xl mx-auto p-4 rounded-lg bg-[#ff4e42]/8 border border-[#ff4e42]/15 flex items-start gap-3 animate-fade-up">
            <svg className="w-4 h-4 text-[#ff4e42] flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="text-sm text-[#ff4e42]">Analysis Failed</p>
              <p className="text-[11px] text-[#ff4e42]/60 mt-1">{error}</p>
              <button onClick={handleAnalyze} className="text-[11px] text-vecton-orange underline mt-2">
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {mobile && desktop && (
          <Dashboard
            mobile={mobile}
            desktop={desktop}
            analysis={analysis}
            isAnalyzing={isAnalyzing}
          />
        )}

        {/* Footer */}
        <footer className="text-center mt-16 pb-8">
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-[1px] bg-vecton-dark/20" />
            <p className="text-[11px] text-vecton-dark/50 uppercase tracking-widest">
              Powered by Google PSI &amp; Claude AI
            </p>
            <div className="w-8 h-[1px] bg-vecton-dark/20" />
          </div>
        </footer>
      </div>
    </div>
  );
}
