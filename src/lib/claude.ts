import Anthropic from '@anthropic-ai/sdk';
import { PSIResult } from './psi';

const SYSTEM_PROMPT = `You are a senior web performance engineer and Core Web Vitals specialist.
You analyze PageSpeed Insights data and provide clear, actionable recommendations.

Your analysis should:
1. Start with a brief executive summary (2-3 sentences)
2. Rate each Core Web Vital (LCP, INP, CLS) with a clear verdict
3. Identify the TOP 3 most impactful issues causing poor scores
4. For each issue, explain WHY it matters and give a specific, actionable fix
5. Prioritize fixes by expected impact (high/medium/low)
6. If comparing mobile vs desktop, highlight key differences

**CRITICAL:** You will receive either Field Data (real user data) OR Lab Data (simulated test):
- **Field Data (CrUX)** represents real users over 28 days. This is the GOLD STANDARD and what you should analyze.
- **Lab Data** is only provided as a fallback when Field Data is unavailable (low-traffic sites).
- ONLY analyze the data type provided. Do NOT mention or reference the other type.

Format your response in clean markdown with headers. Be specific — reference actual values,
elements, and thresholds. Avoid generic advice. If a metric is good, say so briefly and move on.
Focus your energy on what needs fixing.

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

  const userPrompt = `Analyze the following PageSpeed Insights results and provide your expert recommendations:

${formatPSIForPrompt(results)}

Provide a comprehensive but concise analysis. Focus on actionable fixes prioritized by impact.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((block: any) => block.type === 'text') as { text: string } | undefined;
  return textBlock?.text || 'Analysis could not be generated.';
}
