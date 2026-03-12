import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting, deleteSetting } from "@/lib/db";
import {
  DEFAULT_EXTRACTION_SYSTEM_PROMPT,
  DEFAULT_TIER2_SYSTEM_PROMPT,
} from "@/lib/prompts";
import type { PromptsResponse } from "@/lib/types";

export async function GET() {
  const customExtraction = getSetting("extraction_system_prompt");
  const customTier2 = getSetting("tier2_system_prompt");

  const response: PromptsResponse = {
    extraction_system_prompt:
      customExtraction ?? DEFAULT_EXTRACTION_SYSTEM_PROMPT,
    tier2_system_prompt: customTier2 ?? DEFAULT_TIER2_SYSTEM_PROMPT,
    is_extraction_custom: customExtraction !== null,
    is_tier2_custom: customTier2 !== null,
  };

  return NextResponse.json(response);
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { extraction_system_prompt, tier2_system_prompt } = body;

    if (
      extraction_system_prompt !== undefined &&
      (typeof extraction_system_prompt !== "string" ||
        !extraction_system_prompt.trim())
    ) {
      return NextResponse.json(
        { error: "Extraction prompt must be a non-empty string" },
        { status: 400 },
      );
    }

    if (
      tier2_system_prompt !== undefined &&
      (typeof tier2_system_prompt !== "string" || !tier2_system_prompt.trim())
    ) {
      return NextResponse.json(
        { error: "Intelligence prompt must be a non-empty string" },
        { status: 400 },
      );
    }

    if (extraction_system_prompt !== undefined) {
      setSetting("extraction_system_prompt", extraction_system_prompt);
    }
    if (tier2_system_prompt !== undefined) {
      setSetting("tier2_system_prompt", tier2_system_prompt);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { keys } = body as {
      keys: ("extraction_system_prompt" | "tier2_system_prompt")[];
    };

    if (!Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { error: "keys must be a non-empty array" },
        { status: 400 },
      );
    }

    const validKeys = ["extraction_system_prompt", "tier2_system_prompt"];
    for (const key of keys) {
      if (validKeys.includes(key)) {
        deleteSetting(key);
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
