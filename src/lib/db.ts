// SQLite database setup and queries using better-sqlite3

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type {
  AnalysisReport,
  HistoryEntry,
  CostEntry,
  CostSummary,
  VitalRating,
} from "./types";
import { DEFAULT_EXTRACTION_MODEL, DEFAULT_INTELLIGENCE_MODEL } from "./config";

const DB_DIR = path.resolve("./data");
const DB_PATH = path.join(DB_DIR, "vitalscan.db");
const MAX_ANALYSES = 50;

// Use globalThis to survive Next.js hot-reloads
const globalForDb = globalThis as unknown as {
  __vitalscanDb: Database.Database | undefined;
};

function getDb(): Database.Database {
  if (globalForDb.__vitalscanDb) {
    return globalForDb.__vitalscanDb;
  }

  fs.mkdirSync(DB_DIR, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Migrate: drop old cost_logs with FK constraint (it was always failing, no data to lose)
  db.exec("DROP TABLE IF EXISTS cost_logs");

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      report_json TEXT NOT NULL,
      mobile_score REAL,
      desktop_score REAL,
      mobile_inp_rating TEXT,
      mobile_lcp_rating TEXT,
      mobile_cls_rating TEXT,
      desktop_inp_rating TEXT,
      desktop_lcp_rating TEXT,
      desktop_cls_rating TEXT
    );

    CREATE TABLE IF NOT EXISTS cost_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      tier TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_input REAL NOT NULL,
      cost_output REAL NOT NULL,
      cost_total REAL NOT NULL,
      latency_ms INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cost_logs_analysis ON cost_logs(analysis_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default settings if not present
  const seedSetting = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
  );
  seedSetting.run("extraction_model", DEFAULT_EXTRACTION_MODEL);
  seedSetting.run("intelligence_model", DEFAULT_INTELLIGENCE_MODEL);

  // Migrate: switch Opus to Sonnet for cost reduction
  db.prepare(
    "UPDATE settings SET value = ? WHERE key = 'intelligence_model' AND value = 'anthropic/claude-opus-4.6'",
  ).run(DEFAULT_INTELLIGENCE_MODEL);

  globalForDb.__vitalscanDb = db;
  return db;
}

// ----- Analyses -----

export function saveAnalysis(report: AnalysisReport): void {
  const db = getDb();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO analyses
    (id, url, timestamp, report_json,
     mobile_score, desktop_score,
     mobile_inp_rating, mobile_lcp_rating, mobile_cls_rating,
     desktop_inp_rating, desktop_lcp_rating, desktop_cls_rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    report.id,
    report.url,
    report.timestamp,
    JSON.stringify(report),
    report.mobile?.lab_metrics.performance_score ?? null,
    report.desktop?.lab_metrics.performance_score ?? null,
    report.mobile?.field_metrics.inp?.rating ?? null,
    report.mobile?.field_metrics.lcp?.rating ?? null,
    report.mobile?.field_metrics.cls?.rating ?? null,
    report.desktop?.field_metrics.inp?.rating ?? null,
    report.desktop?.field_metrics.lcp?.rating ?? null,
    report.desktop?.field_metrics.cls?.rating ?? null,
  );

  // Auto-cleanup: keep only the latest MAX_ANALYSES
  db.prepare(
    `DELETE FROM analyses WHERE id NOT IN (
      SELECT id FROM analyses ORDER BY timestamp DESC LIMIT ?
    )`,
  ).run(MAX_ANALYSES);
}

export function getAnalysis(id: string): AnalysisReport | null {
  const db = getDb();
  const row = db
    .prepare("SELECT report_json FROM analyses WHERE id = ?")
    .get(id) as { report_json: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.report_json) as AnalysisReport;
}

export function getHistory(): HistoryEntry[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id AS analysis_id, url, timestamp,
              mobile_score, desktop_score,
              mobile_inp_rating, mobile_lcp_rating, mobile_cls_rating,
              desktop_inp_rating, desktop_lcp_rating, desktop_cls_rating
       FROM analyses
       ORDER BY timestamp DESC
       LIMIT ?`,
    )
    .all(MAX_ANALYSES) as Array<{
    analysis_id: string;
    url: string;
    timestamp: string;
    mobile_score: number | null;
    desktop_score: number | null;
    mobile_inp_rating: string | null;
    mobile_lcp_rating: string | null;
    mobile_cls_rating: string | null;
    desktop_inp_rating: string | null;
    desktop_lcp_rating: string | null;
    desktop_cls_rating: string | null;
  }>;

  return rows.map((row) => ({
    analysis_id: row.analysis_id,
    url: row.url,
    timestamp: row.timestamp,
    mobile_score: row.mobile_score,
    desktop_score: row.desktop_score,
    mobile_inp_rating: row.mobile_inp_rating as VitalRating | null,
    mobile_lcp_rating: row.mobile_lcp_rating as VitalRating | null,
    mobile_cls_rating: row.mobile_cls_rating as VitalRating | null,
    desktop_inp_rating: row.desktop_inp_rating as VitalRating | null,
    desktop_lcp_rating: row.desktop_lcp_rating as VitalRating | null,
    desktop_cls_rating: row.desktop_cls_rating as VitalRating | null,
  }));
}

// ----- Cost Logs -----

export function logCost(entry: Omit<CostEntry, "url">): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO cost_logs
     (analysis_id, timestamp, tier, model, input_tokens, output_tokens,
      cost_input, cost_output, cost_total, latency_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.analysis_id,
    entry.timestamp,
    entry.tier,
    entry.model,
    entry.input_tokens,
    entry.output_tokens,
    entry.cost_total * 0.4, // approximate input portion
    entry.cost_total * 0.6, // approximate output portion
    entry.cost_total,
    entry.latency_ms,
  );
}

export function getCostSummary(): CostSummary {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.analysis_id, a.url, c.timestamp, c.tier, c.model,
              c.input_tokens, c.output_tokens, c.cost_total, c.latency_ms
       FROM cost_logs c
       LEFT JOIN analyses a ON c.analysis_id = a.id
       ORDER BY c.timestamp DESC`,
    )
    .all() as Array<{
    analysis_id: string;
    url: string | null;
    timestamp: string;
    tier: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_total: number;
    latency_ms: number;
  }>;

  const analyses: CostEntry[] = rows.map((row) => ({
    analysis_id: row.analysis_id,
    url: row.url ?? "unknown",
    timestamp: row.timestamp,
    tier: row.tier as "extraction" | "intelligence",
    model: row.model,
    input_tokens: row.input_tokens,
    output_tokens: row.output_tokens,
    cost_total: row.cost_total,
    latency_ms: row.latency_ms,
  }));

  const total_spend = analyses.reduce((sum, e) => sum + e.cost_total, 0);

  return { total_spend, analyses };
}

// ----- Settings -----

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
    key,
    value,
  );
}

export function deleteSetting(key: string): void {
  const db = getDb();
  db.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

export function getAllSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{
    key: string;
    value: string;
  }>;
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}
