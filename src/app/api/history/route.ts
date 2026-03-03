// GET /api/history — Return last 50 analyses

import { NextResponse } from "next/server";
import { getHistory } from "@/lib/db";

export async function GET() {
  try {
    const history = getHistory();
    return NextResponse.json(history);
  } catch (error: unknown) {
    console.error("History fetch error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch history",
      },
      { status: 500 },
    );
  }
}
