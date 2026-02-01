// Google PageSpeed Insights API client

export interface PSIResult {
  strategy: 'mobile' | 'desktop';
  url: string;
  fetchTime: string;
  overallScore: number;
  metrics: {
    lcp: MetricData;
    inp: MetricData;
    cls: MetricData;
    fcp: MetricData;
    tbt: MetricData;
    si: MetricData;
    ttfb: MetricData;
  };
  fieldData?: FieldData;
  diagnostics: DiagnosticItem[];
  opportunities: OpportunityItem[];
  screenshots?: string[];
}

export interface FieldData {
  lcp?: FieldMetric;
  inp?: FieldMetric;
  cls?: FieldMetric;
  fcp?: FieldMetric;
  fid?: FieldMetric;
  ttfb?: FieldMetric;
}

export interface FieldMetric {
  percentile: number;
  category: 'FAST' | 'AVERAGE' | 'SLOW';
  distributions: {
    min: number;
    max: number | null;
    proportion: number;
  }[];
}

export interface MetricData {
  name: string;
  shortName: string;
  value: number;
  displayValue: string;
  score: number; // 0-1
  rating: 'good' | 'needs-improvement' | 'poor';
  description: string;
}

export interface DiagnosticItem {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue?: string;
}

export interface OpportunityItem {
  id: string;
  title: string;
  description: string;
  score: number | null;
  savings?: string;
  displayValue?: string;
}

// Thresholds for Core Web Vitals
const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  inp: { good: 200, poor: 500 },
  cls: { good: 0.1, poor: 0.25 },
  fcp: { good: 1800, poor: 3000 },
  tbt: { good: 200, poor: 600 },
  si: { good: 3400, poor: 5800 },
  ttfb: { good: 800, poor: 1800 },
};

function getRating(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[metric as keyof typeof THRESHOLDS];
  if (!threshold) return 'needs-improvement';
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

function extractMetric(
  audits: any,
  auditId: string,
  shortName: string,
  name: string,
  metricKey: string,
  description: string
): MetricData {
  const audit = audits[auditId];
  if (!audit) {
    return {
      name,
      shortName,
      value: 0,
      displayValue: 'N/A',
      score: 0,
      rating: 'poor',
      description,
    };
  }

  const value = audit.numericValue || 0;
  const score = audit.score ?? 0;

  return {
    name,
    shortName,
    value,
    displayValue: audit.displayValue || `${Math.round(value)} ms`,
    score,
    rating: getRating(metricKey, value),
    description,
  };
}

export async function fetchPSI(
  url: string,
  strategy: 'mobile' | 'desktop',
  apiKey: string
): Promise<PSIResult> {
  const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  apiUrl.searchParams.set('url', url);
  apiUrl.searchParams.set('key', apiKey);
  apiUrl.searchParams.set('strategy', strategy);
  apiUrl.searchParams.set('category', 'performance');

  const response = await fetch(apiUrl.toString());

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `PSI API error (${response.status}): ${error.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  const lighthouse = data.lighthouseResult;
  const audits = lighthouse?.audits || {};

  // Extract field data (CrUX - real user data)
  const loadingExperience = data.loadingExperience;
  let fieldData: FieldData | undefined;

  if (loadingExperience && loadingExperience.metrics) {
    const extractFieldMetric = (metricData: any): FieldMetric | undefined => {
      if (!metricData) return undefined;
      return {
        percentile: metricData.percentile || 0,
        category: metricData.category || 'AVERAGE',
        distributions: metricData.distributions || [],
      };
    };

    fieldData = {
      lcp: extractFieldMetric(loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS),
      inp: extractFieldMetric(loadingExperience.metrics.INTERACTION_TO_NEXT_PAINT),
      cls: extractFieldMetric(loadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE),
      fcp: extractFieldMetric(loadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS),
      fid: extractFieldMetric(loadingExperience.metrics.FIRST_INPUT_DELAY_MS),
      ttfb: extractFieldMetric(loadingExperience.metrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE),
    };
  }

  // Extract metrics
  const metrics = {
    lcp: extractMetric(
      audits,
      'largest-contentful-paint',
      'LCP',
      'Largest Contentful Paint',
      'lcp',
      'Time until the largest content element is visible'
    ),
    inp: extractMetric(
      audits,
      'interaction-to-next-paint',
      'INP',
      'Interaction to Next Paint',
      'inp',
      'Responsiveness to user interactions'
    ),
    cls: {
      ...extractMetric(
        audits,
        'cumulative-layout-shift',
        'CLS',
        'Cumulative Layout Shift',
        'cls',
        'Visual stability — how much the layout shifts during loading'
      ),
      displayValue: audits['cumulative-layout-shift']?.displayValue || 
        (audits['cumulative-layout-shift']?.numericValue?.toFixed(3) ?? 'N/A'),
    },
    fcp: extractMetric(
      audits,
      'first-contentful-paint',
      'FCP',
      'First Contentful Paint',
      'fcp',
      'Time until the first content is painted on screen'
    ),
    tbt: extractMetric(
      audits,
      'total-blocking-time',
      'TBT',
      'Total Blocking Time',
      'tbt',
      'Total time the main thread was blocked'
    ),
    si: extractMetric(
      audits,
      'speed-index',
      'SI',
      'Speed Index',
      'si',
      'How quickly content is visually displayed during load'
    ),
    ttfb: extractMetric(
      audits,
      'server-response-time',
      'TTFB',
      'Time to First Byte',
      'ttfb',
      'Server response time for the main document'
    ),
  };

  // Extract diagnostics
  const diagnosticIds = [
    'dom-size',
    'mainthread-work-breakdown',
    'bootup-time',
    'font-display',
    'third-party-summary',
    'long-tasks',
    'layout-shifts',
    'non-composited-animations',
    'unsized-images',
    'viewport',
  ];

  const diagnostics: DiagnosticItem[] = diagnosticIds
    .map((id) => audits[id])
    .filter(Boolean)
    .filter((audit) => audit.score !== null && audit.score < 1)
    .map((audit) => ({
      id: audit.id,
      title: audit.title,
      description: audit.description,
      score: audit.score,
      displayValue: audit.displayValue,
    }));

  // Extract opportunities
  const opportunityIds = [
    'render-blocking-resources',
    'unused-css-rules',
    'unused-javascript',
    'modern-image-formats',
    'offscreen-images',
    'unminified-css',
    'unminified-javascript',
    'efficient-animated-content',
    'duplicated-javascript',
    'legacy-javascript',
    'uses-optimized-images',
    'uses-responsive-images',
    'uses-text-compression',
    'server-response-time',
    'redirects',
    'preload-lcp-element',
    'uses-rel-preconnect',
  ];

  const opportunities: OpportunityItem[] = opportunityIds
    .map((id) => audits[id])
    .filter(Boolean)
    .filter((audit) => audit.score !== null && audit.score < 1)
    .map((audit) => ({
      id: audit.id,
      title: audit.title,
      description: audit.description,
      score: audit.score,
      savings: audit.displayValue,
      displayValue: audit.displayValue,
    }));

  return {
    strategy,
    url: data.id || url,
    fetchTime: lighthouse?.fetchTime || new Date().toISOString(),
    overallScore: (lighthouse?.categories?.performance?.score ?? 0) * 100,
    metrics,
    fieldData,
    diagnostics,
    opportunities,
  };
}
