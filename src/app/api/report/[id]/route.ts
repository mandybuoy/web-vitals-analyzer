// GET /api/report/[id] — Fetch completed analysis report

import { NextRequest, NextResponse } from "next/server";
import { getAnalysis } from "@/lib/db";
import { getPipelineStatus } from "@/lib/pipeline-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Check if still running
  const status = getPipelineStatus(id);
  if (status && status.progress_pct < 100 && !status.error) {
    return NextResponse.json(
      { message: "Analysis still in progress" },
      { status: 202 },
    );
  }

  const report = getAnalysis(id);
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json(report);
}
