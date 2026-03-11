// POST /api/analyze — Start async analysis pipeline
// Returns { analysis_id } with 202 status

import { NextRequest, NextResponse } from "next/server";
import {
  createPipeline,
  isAnyPipelineRunning,
  getRunningPipelineId,
  cancelPipeline,
} from "@/lib/pipeline-store";
import { runPipeline } from "@/lib/pipeline";

export async function POST(request: NextRequest) {
  try {
    const { url, psi_only } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 },
      );
    }

    // Concurrency gate: auto-cancel stale pipeline instead of hard 429
    if (isAnyPipelineRunning()) {
      const staleId = getRunningPipelineId();
      if (staleId) {
        cancelPipeline(staleId);
        console.log(`[analyze] Auto-cancelled stale pipeline ${staleId}`);
      }
    }

    const analysisId = crypto.randomUUID();
    createPipeline(analysisId);

    // Fire-and-forget: don't await the pipeline
    runPipeline(analysisId, url, { psiOnly: !!psi_only }).catch((err) => {
      console.error("[analyze] Pipeline error:", err);
    });

    return NextResponse.json({ analysis_id: analysisId }, { status: 202 });
  } catch (error: unknown) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to start analysis",
      },
      { status: 500 },
    );
  }
}
