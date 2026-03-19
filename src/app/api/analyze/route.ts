// POST /api/analyze — Start async analysis pipeline
// Returns { analysis_id } with 202 status

import { NextRequest, NextResponse } from "next/server";
import { createPipeline } from "@/lib/pipeline-store";
import { runPipeline } from "@/lib/pipeline";

export async function POST(request: NextRequest) {
  try {
    const { url, psi_only, tech_stack } = await request.json();

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

    const analysisId = crypto.randomUUID();
    createPipeline(analysisId);

    // Fire-and-forget: don't await the pipeline
    runPipeline(analysisId, url, {
      psiOnly: !!psi_only,
      techStack: tech_stack || undefined,
    }).catch((err) => {
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
