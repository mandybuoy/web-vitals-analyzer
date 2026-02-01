# VitalScan — Core Web Vitals Analyzer

AI-powered web performance analyzer that scans any URL for Core Web Vitals and provides actionable recommendations using Claude.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38bdf8) ![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)

## Features

- **Full CWV Audit** — Scans LCP, INP, CLS, FCP, TBT, Speed Index, and TTFB
- **Mobile + Desktop** — Side-by-side analysis for both strategies
- **AI Recommendations** — Claude analyzes results and gives prioritized, actionable fixes
- **Visual Dashboard** — Color-coded score gauges, metric cards, and opportunity list
- **One-click Deploy** — Ready for Vercel

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/web-vitals-analyzer.git
cd web-vitals-analyzer
npm install
```

### 2. Set Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```
GOOGLE_PSI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

**Getting your API keys:**

| Key | Where | Cost |
|-----|-------|------|
| `GOOGLE_PSI_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Enable "PageSpeed Insights API" → Create Credentials → API Key | Free |
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com/settings/keys) → Create Key | Pay-per-use |

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Deploy to Vercel

```bash
npx vercel
```

Or connect your GitHub repo in the [Vercel Dashboard](https://vercel.com/new). Set the two environment variables in your Vercel project settings.

## Architecture

```
src/
├── app/
│   ├── page.tsx           # Main page with URL input
│   ├── layout.tsx         # Root layout
│   ├── globals.css        # Global styles + Tailwind
│   └── api/
│       ├── analyze/       # POST: Fetches PSI data (mobile + desktop)
│       └── recommend/     # POST: Sends results to Claude for analysis
├── components/
│   ├── Dashboard.tsx      # Main results dashboard with tabs
│   ├── ScoreGauge.tsx     # Circular SVG score indicator
│   ├── MetricCard.tsx     # Individual metric display card
│   └── AnalysisReport.tsx # Renders Claude's markdown analysis
└── lib/
    ├── psi.ts             # Google PageSpeed Insights API client
    └── claude.ts          # Claude analysis prompt & client
```

## Flow

```
User enters URL
    → POST /api/analyze
        → Calls PSI API (mobile + desktop in parallel)
        → Returns structured metric data
    → POST /api/recommend
        → Formats PSI data into prompt
        → Sends to Claude for expert analysis
        → Returns markdown recommendations
    → Dashboard renders scores, metrics, opportunities, and AI analysis
```

## Roadmap

- [ ] **Site crawler** — Map all URLs from a domain and scan each
- [ ] **Daily cron monitoring** — Track changes over time with alerting
- [ ] **Historical trends** — Chart metric changes over days/weeks
- [ ] **Pre-publish agent** — IDE/CLI tool that checks vitals before deploy
- [ ] **Brand kit theming** — Custom colors/fonts from design system

## License

MIT
