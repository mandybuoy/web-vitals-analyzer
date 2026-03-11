// GET /api/settings — Return settings, key status, costs
// PUT /api/settings — Update model selections

import { NextRequest, NextResponse } from "next/server";
import { getAllSettings, setSetting } from "@/lib/db";
import { getCostSummary } from "@/lib/db";
import {
  getGoogleApiKey,
  getAnthropicApiKey,
  maskApiKey,
  AVAILABLE_MODELS,
} from "@/lib/config";
import type { SettingsResponse } from "@/lib/types";

export async function GET() {
  try {
    const settings = getAllSettings();
    const costs = getCostSummary();

    const response: SettingsResponse = {
      extraction_model: settings.extraction_model ?? "",
      intelligence_model: settings.intelligence_model ?? "",
      google_key_status: maskApiKey(getGoogleApiKey()),
      openrouter_key_status: maskApiKey(getAnthropicApiKey()),
      available_models: AVAILABLE_MODELS,
      costs,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("Settings fetch error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch settings",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate model selections against allowlist
    if (body.extraction_model) {
      if (!AVAILABLE_MODELS.includes(body.extraction_model)) {
        return NextResponse.json(
          { error: `Invalid extraction model: ${body.extraction_model}` },
          { status: 400 },
        );
      }
      setSetting("extraction_model", body.extraction_model);
    }

    if (body.intelligence_model) {
      if (!AVAILABLE_MODELS.includes(body.intelligence_model)) {
        return NextResponse.json(
          { error: `Invalid intelligence model: ${body.intelligence_model}` },
          { status: 400 },
        );
      }
      setSetting("intelligence_model", body.intelligence_model);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Settings update error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update settings",
      },
      { status: 500 },
    );
  }
}
