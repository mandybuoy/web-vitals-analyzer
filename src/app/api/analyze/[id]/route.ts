// DELETE /api/analyze/[id] — Cancel a running analysis

import { NextRequest, NextResponse } from "next/server";
import { cancelPipeline, getPipelineStatus } from "@/lib/pipeline-store";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const status = getPipelineStatus(id);
  if (!status) {
    return NextResponse.json(
      { error: "Analysis not found or expired" },
      { status: 404 },
    );
  }

  // Already completed — no-op
  if (status.progress_pct >= 100) {
    return NextResponse.json({ message: "Already completed" }, { status: 200 });
  }

  cancelPipeline(id);
  return new NextResponse(null, { status: 204 });
}
