// Cost tracking — logs LLM usage to SQLite

import { logCost } from "./db";

interface CostRecord {
  analysis_id: string;
  timestamp: string;
  tier: "extraction" | "intelligence";
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_total: number;
  latency_ms: number;
}

export function trackCost(record: CostRecord): void {
  try {
    logCost(record);
  } catch (err) {
    // Non-fatal: log warning but don't break the pipeline
    console.warn("[cost-tracker] Failed to log cost:", err);
  }
}
