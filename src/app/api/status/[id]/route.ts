// GET /api/status/[id] — Poll pipeline status

import { NextRequest, NextResponse } from "next/server";
import { getPipelineStatus } from "@/lib/pipeline-store";

export async function GET(
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

  return NextResponse.json(status);
}
