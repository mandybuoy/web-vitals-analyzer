import Anthropic from '@anthropic-ai/sdk';
import { PSIResult } from './psi';

const SYSTEM_PROMPT = `You are a senior web performance engineer and Core Web Vitals specialist.
You analyze PageSpeed Insights data and provide clear, actionable recommendations.

Your analysis format:
1. Executive Summary (2-3 sentences) - overall performance verdict
2. Core Web Vitals Diagnosis - rate LCP, INP, CLS with actual values and verdicts
3. Top Issues - identify 3 most critical problems with specific details
4. Recommendations - actionable fixes prioritized by impact (high/medium/low)

**CRITICAL RULES:**
- You will receive either Field Data (real user data) OR Lab Data (simulated test)
- Field Data (CrUX) is the gold standard when available
- ONLY analyze the data type provided
- Be specific with actual values and technical details
- NO timeline-based suggestions (no "week 1", "week 2", "phase 1", etc.)
- NO implementation roadmaps or scheduling
- Focus ONLY on: what's wrong, why it matters, and how to fix it
- Keep responses concise - under 1000 words
- Use markdown headers properly (# Header, not $2 or ##)

Thresholds for reference:
- LCP: Good < 2.5s, Needs Improvement < 4s, Poor > 4s
- INP: Good < 200ms, Needs Improvement < 500ms, Poor > 500ms
- CLS: Good < 0.1, Needs Improvement < 0.25, Poor > 0.25
- FCP: Good < 1.8s, Needs Improvement < 3s, Poor > 3s
- TBT: Good < 200ms, Needs Improvement < 600ms, Poor > 600ms
- SI: Good < 3.4s, Needs Improvement < 5.8s, Poor > 5.8s
- TTFB: Good < 800ms, Needs Improvement < 1800ms, Poor > 1800ms`;

function formatPSIForPrompt(results: PSIResult[]): string {
  return results
    .map((r) => {
      // Check if field data is available
      const hasFieldData = r.fieldData && Object.keys(r.fieldData).some(
        key => r.fieldData?.[key as keyof typeof r.fieldData]
      );

      let metricsSection = '';

      if (hasFieldData && r.fieldData) {
        // Use Field Data (Real User Data) - PRIORITY
        const fieldMetrics = [];
        if (r.fieldData.lcp) {
          fieldMetrics.push(`  LCP: ${(r.fieldData.lcp.percentile / 1000).toFixed(2)}s — Rating: ${r.fieldData.lcp.category}`);
        }
        if (r.fieldData.inp) {
          fieldMetrics.push(`  INP: ${r.fieldData.inp.percentile}ms — Rating: ${r.fieldData.inp.category}`);
        }
        if (r.fieldData.cls) {
          fieldMetrics.push(`  CLS: ${(r.fieldData.cls.percentile / 100).toFixed(3)} — Rating: ${r.fieldData.cls.category}`);
        }
        if (r.fieldData.fcp) {
          fieldMetrics.push(`  FCP: ${(r.fieldData.fcp.percentile / 1000).toFixed(2)}s — Rating: ${r.fieldData.fcp.category}`);
        }
        metricsSection = `FIELD DATA (Real User Data - 28 days, 75th percentile):\n${fieldMetrics.join('\n')}`;
      } else {
        // Fallback to Lab Data
        const labMetrics = Object.entries(r.metrics)
          .map(
            ([key, m]) =>
              `  ${m.shortName}: ${m.displayValue} — Score: ${(m.score * 100).toFixed(0)}/100 — Rating: ${m.rating.toUpperCase()}`
          )
          .join('\n');
        metricsSection = `LAB DATA (Simulated Test - no field data available for this site):\n${labMetrics}`;
      }

      const oppsStr = r.opportunities.length
        ? r.opportunities
            .map((o) => `  - ${o.title}${o.savings ? ` (potential savings: ${o.savings})` : ''}`)
            .join('\n')
        : '  None identified';

      const diagStr = r.diagnostics.length
        ? r.diagnostics
            .map((d) => `  - ${d.title}${d.displayValue ? ` (${d.displayValue})` : ''}`)
            .join('\n')
        : '  None identified';

      return `
=== ${r.strategy.toUpperCase()} ANALYSIS ===
URL: ${r.url}
${hasFieldData ? 'Data Source: Real Users (CrUX)' : 'Data Source: Lab Test (Lighthouse)'}
Tested at: ${r.fetchTime}

${metricsSection}

OPPORTUNITIES (things to fix):
${oppsStr}

DIAGNOSTICS (things to investigate):
${diagStr}
`;
    })
    .join('\n\n');
}

export async function analyzeWithClaude(
  results: PSIResult[],
  apiKey: string
): Promise<string> {
  const anthropic = new Anthropic({ apiKey });

  const userPrompt = `Analyze the following PageSpeed Insights results:

${formatPSIForPrompt(results)}

Provide a focused analysis: diagnose the issues, explain why they matter, and recommend specific fixes prioritized by impact. Keep it concise and actionable. No timelines or implementation schedules.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((block: any) => block.type === 'text') as { text: string } | undefined;
  return textBlock?.text || 'Analysis could not be generated.';
}
