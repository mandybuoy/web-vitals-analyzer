#!/usr/bin/env node

// E2E test script for VitalScan pipeline
// Usage:
//   node scripts/e2e-test.mjs              # Full analysis (all 4 stages)
//   node scripts/e2e-test.mjs --psi-only   # PSI + HTML extraction only (stages 1-2)
//   node scripts/e2e-test.mjs --urls=0,3   # Run specific URL indices only

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// ---- Configuration ----

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const POLL_INTERVAL_MS = 3_000;
const URL_COOLDOWN_MS = 3_000;
const FULL_TIMEOUT_MS = 10 * 60 * 1000; // 10 min per URL
const PSI_ONLY_TIMEOUT_MS = 5 * 60 * 1000; // 5 min per URL

const TEST_URLS = [
  { url: "https://www.vijaysales.com/", client: "Vijay Sales" },
  { url: "https://www.vijaysales.com/c/iphones", client: "Vijay Sales" },
  {
    url: "https://www.vijaysales.com/p/P245195/245195/apple-iphone-17-pro-256gb-cosmic-orange",
    client: "Vijay Sales",
  },
  {
    url: "https://au.bank.in/personal-banking/digital-banking/au-0101-mobile-banking-app",
    client: "AU Bank",
  },
  { url: "https://www.piramalfinance.com/", client: "Piramal Finance" },
  {
    url: "https://www.piramalfinance.com/personal-loan",
    client: "Piramal Finance",
  },
  { url: "https://www.idfcfirst.bank.in/", client: "IDFC Bank" },
  {
    url: "https://www.idfcfirst.bank.in/financial-calculators/personal-loan-calculator",
    client: "IDFC Bank",
  },
  { url: "https://www.indiafirstlife.com/", client: "IndiaFirst Life" },
  {
    url: "https://www.indiafirstlife.com/health-calculators/bmi-calculator",
    client: "IndiaFirst Life",
  },
];

// ---- Arg parsing ----

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`VitalScan E2E Test Script

Usage:
  node scripts/e2e-test.mjs [options]

Options:
  --psi-only     Run only stages 1-2 (PSI + HTML extraction), skip Opus LLM calls
  --urls=0,3,7   Run specific URL indices only (0-based, comma-separated)
  --no-save      Skip saving results JSON to disk
  --help, -h     Show this help message

URLs tested:
${TEST_URLS.map((t, i) => `  ${i}: ${t.url}`).join("\n")}
`);
    process.exit(0);
  }

  const psiOnly = args.includes("--psi-only");
  const noSave = args.includes("--no-save");

  let urlIndices = null;
  const urlsArg = args.find((a) => a.startsWith("--urls="));
  if (urlsArg) {
    urlIndices = urlsArg
      .split("=")[1]
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n) && n >= 0 && n < TEST_URLS.length);
  }

  return { psiOnly, urlIndices, noSave };
}

// ---- Helpers ----

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = ((ms % 60_000) / 1000).toFixed(0);
  return `${mins}m ${secs}s`;
}

function truncateUrl(url, max = 55) {
  if (url.length <= max) return url;
  return url.slice(0, max - 3) + "...";
}

function padRight(str, len) {
  return String(str).padEnd(len);
}

function padLeft(str, len) {
  return String(str).padStart(len);
}

// ---- API helpers ----

async function apiPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (res.status === 204) return { status: 204, data: null };
  return { status: res.status, data: await res.json() };
}

async function apiDelete(path) {
  const res = await fetch(`${BASE_URL}${path}`, { method: "DELETE" });
  return { status: res.status };
}

// ---- Server health check ----

async function checkServer() {
  try {
    const { status, data } = await apiGet("/api/settings");
    if (status !== 200) throw new Error(`Settings returned ${status}`);

    console.log(`Server OK at ${BASE_URL}`);
    console.log(`  Extraction model:  ${data.extraction_model || "(default)"}`);
    console.log(
      `  Intelligence model: ${data.intelligence_model || "(default)"}`,
    );
    console.log(`  Google PSI key:    ${data.google_key_status}`);
    console.log(`  Anthropic key:     ${data.openrouter_key_status}`);

    if (!data.google_key_status || data.google_key_status === "Not set") {
      console.error("\nERROR: GOOGLE_PSI_API_KEY not configured");
      process.exit(1);
    }

    return data;
  } catch (err) {
    console.error(`Cannot reach server at ${BASE_URL}: ${err.message}`);
    console.error("Make sure the app is running: npm run dev");
    process.exit(1);
  }
}

// ---- Compute stage timings from timestamps ----

function computeTimings(timestamps) {
  if (!timestamps) return {};
  const timings = {};
  for (let i = 1; i <= 4; i++) {
    const start = timestamps[`stage_${i}_start`];
    const end = timestamps[`stage_${i}_end`];
    if (start && end) {
      timings[`stage_${i}_ms`] = new Date(end) - new Date(start);
    }
  }
  return timings;
}

// ---- Core: run a single URL through the pipeline ----

async function runSingleUrl(url, psiOnly) {
  const startTime = Date.now();
  const timeoutMs = psiOnly ? PSI_ONLY_TIMEOUT_MS : FULL_TIMEOUT_MS;

  const result = {
    url,
    analysis_id: null,
    mode: psiOnly ? "psi-only" : "full",
    status: "fail",
    stage_reached: 0,
    stage_name: "",
    duration_ms: 0,
    stage_timings: {},
    mobile_score: null,
    desktop_score: null,
    warnings: [],
    error: null,
  };

  try {
    // Start analysis
    const { status, data } = await apiPost("/api/analyze", { url });
    if (status !== 202) {
      throw new Error(
        `POST /api/analyze returned ${status}: ${JSON.stringify(data)}`,
      );
    }

    result.analysis_id = data.analysis_id;
    const id = data.analysis_id;

    // Poll loop
    let cancelled = false;
    while (true) {
      if (Date.now() - startTime > timeoutMs) {
        result.status = "timeout";
        result.error = `Timed out after ${formatDuration(timeoutMs)}`;
        await apiDelete(`/api/analyze/${id}`).catch(() => {});
        break;
      }

      await sleep(POLL_INTERVAL_MS);

      const pollRes = await apiGet(`/api/status/${id}`);
      if (pollRes.status !== 200) {
        result.error = `Status poll returned ${pollRes.status}`;
        break;
      }

      const s = pollRes.data;
      result.stage_reached = s.stage;
      result.stage_name = s.stage_name;
      result.stage_timings = computeTimings(s.stage_timestamps);

      // PSI-only: cancel once stage 3 starts (stages 1-2 are done)
      if (psiOnly && s.stage >= 3 && !cancelled) {
        await apiDelete(`/api/analyze/${id}`);
        cancelled = true;
        // Brief wait then confirm
        await sleep(1000);
        const confirmRes = await apiGet(`/api/status/${id}`);
        if (confirmRes.status === 200) {
          result.stage_timings = computeTimings(
            confirmRes.data.stage_timestamps,
          );
          result.stage_reached = confirmRes.data.stage;
          result.stage_name = confirmRes.data.stage_name;
        }
        result.status = "pass";
        break;
      }

      // Check for pipeline error
      if (s.error) {
        result.error = s.error;
        result.status = "fail";
        break;
      }

      // Full mode: check completion
      if (s.progress_pct >= 100) {
        result.status = "pass";
        break;
      }
    }

    // Full mode: fetch and validate report
    if (!psiOnly && result.status === "pass") {
      const reportRes = await apiGet(`/api/report/${id}`);
      if (reportRes.status === 200) {
        const report = reportRes.data;
        result.mobile_score =
          report.mobile?.lab_metrics?.performance_score ?? null;
        result.desktop_score =
          report.desktop?.lab_metrics?.performance_score ?? null;
        result.warnings = report.warnings || [];

        if (!report.mobile && !report.desktop) {
          result.status = "fail";
          result.error = "Report has no device data";
        }
      } else {
        result.status = "fail";
        result.error = `Report fetch returned ${reportRes.status}`;
      }
    }
  } catch (err) {
    result.error = err.message;
    result.status = "fail";
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

// ---- Summary output ----

function printSummary(results, psiOnly) {
  console.log("\n" + "=".repeat(130));
  console.log(
    `  E2E RESULTS  |  Mode: ${psiOnly ? "PSI-ONLY (stages 1-2)" : "FULL (stages 1-4)"}  |  ${new Date().toLocaleString()}`,
  );
  console.log("=".repeat(130));

  // Header
  const header = psiOnly
    ? `  #  ${padRight("URL", 57)} ${padRight("Status", 9)} ${padRight("Stage", 14)} ${padRight("Duration", 10)} ${padRight("S1", 8)} ${padRight("S2", 8)}`
    : `  #  ${padRight("URL", 57)} ${padRight("Status", 9)} ${padRight("Stage", 14)} ${padRight("Duration", 10)} ${padLeft("Mobile", 7)} ${padLeft("Desktop", 8)}`;
  console.log(header);
  console.log("-".repeat(130));

  results.forEach((r, i) => {
    const status =
      r.status === "pass" ? "PASS" : r.status === "timeout" ? "TIME" : "FAIL";
    const stageStr = `${r.stage_reached} (${r.stage_name})`;
    const dur = formatDuration(r.duration_ms);

    if (psiOnly) {
      const s1 = r.stage_timings.stage_1_ms
        ? formatDuration(r.stage_timings.stage_1_ms)
        : "-";
      const s2raw = r.stage_timings.stage_2_ms;
      const s2 = s2raw
        ? s2raw < 100
          ? "skipped"
          : formatDuration(s2raw)
        : "-";
      console.log(
        `${padLeft(i + 1, 3)}  ${padRight(truncateUrl(r.url), 57)} ${padRight(status, 9)} ${padRight(stageStr, 14)} ${padRight(dur, 10)} ${padRight(s1, 8)} ${padRight(s2, 8)}${r.error ? `  ${r.error}` : ""}`,
      );
    } else {
      const mob = r.mobile_score !== null ? String(r.mobile_score) : "-";
      const desk = r.desktop_score !== null ? String(r.desktop_score) : "-";
      console.log(
        `${padLeft(i + 1, 3)}  ${padRight(truncateUrl(r.url), 57)} ${padRight(status, 9)} ${padRight(stageStr, 14)} ${padRight(dur, 10)} ${padLeft(mob, 7)} ${padLeft(desk, 8)}${r.error ? `  ${r.error}` : ""}`,
      );
    }
  });

  console.log("-".repeat(130));

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const timedOut = results.filter((r) => r.status === "timeout").length;
  const totalDuration = results.reduce((s, r) => s + r.duration_ms, 0);

  console.log(
    `\n  Total: ${results.length}  |  Pass: ${passed}  |  Fail: ${failed}  |  Timeout: ${timedOut}  |  Duration: ${formatDuration(totalDuration)}`,
  );
}

function saveResults(results, psiOnly) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const mode = psiOnly ? "psi-only" : "full";
  const filename = `e2e-results-${mode}-${timestamp}.json`;
  const dataDir = join(PROJECT_ROOT, "data");
  const filepath = join(dataDir, filename);

  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    filepath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        mode,
        base_url: BASE_URL,
        results,
      },
      null,
      2,
    ),
  );

  console.log(`\n  Results saved to data/${filename}`);
}

// ---- Main ----

async function main() {
  const { psiOnly, urlIndices, noSave } = parseArgs();

  const mode = psiOnly ? "PSI-ONLY (stages 1-2)" : "FULL (stages 1-4)";
  console.log(`\nVitalScan E2E Test  --  ${mode}\n`);

  await checkServer();

  const urls = urlIndices
    ? urlIndices.map((i) => TEST_URLS[i]).filter(Boolean)
    : TEST_URLS;

  console.log(
    `\nRunning ${urls.length} URL${urls.length > 1 ? "s" : ""} in ${psiOnly ? "psi-only" : "full"} mode...\n`,
  );

  const results = [];
  for (let i = 0; i < urls.length; i++) {
    const { url, client } = urls[i];
    console.log(`[${i + 1}/${urls.length}] ${client} -- ${url}`);

    const result = await runSingleUrl(url, psiOnly);
    results.push(result);

    const icon =
      result.status === "pass"
        ? "PASS"
        : result.status === "timeout"
          ? "TIME"
          : "FAIL";
    const extra = [];
    if (result.stage_timings.stage_1_ms)
      extra.push(`S1: ${formatDuration(result.stage_timings.stage_1_ms)}`);
    if (result.stage_timings.stage_2_ms) {
      const s2 = result.stage_timings.stage_2_ms;
      extra.push(
        s2 < 100 ? "S2: skipped (no HTML)" : `S2: ${formatDuration(s2)}`,
      );
    }
    if (!psiOnly && result.stage_timings.stage_3_ms)
      extra.push(`S3: ${formatDuration(result.stage_timings.stage_3_ms)}`);
    if (result.mobile_score !== null)
      extra.push(`Mobile: ${result.mobile_score}`);
    if (result.desktop_score !== null)
      extra.push(`Desktop: ${result.desktop_score}`);

    console.log(
      `  ${icon} -- stage ${result.stage_reached} (${result.stage_name}) -- ${formatDuration(result.duration_ms)}${extra.length ? " -- " + extra.join(", ") : ""}${result.error ? ` -- ${result.error}` : ""}\n`,
    );

    // Cooldown between URLs (not after last)
    if (i < urls.length - 1) {
      await sleep(URL_COOLDOWN_MS);
    }
  }

  printSummary(results, psiOnly);

  if (!noSave) {
    saveResults(results, psiOnly);
  }

  // Exit with non-zero if any failures
  const failures = results.filter((r) => r.status !== "pass");
  process.exit(failures.length > 0 ? 1 : 0);
}

main();
