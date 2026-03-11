// Anthropic API client for LLM calls

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAnthropicApiKey, MODEL_PRICING } from "./config";
import { trackCost } from "./cost-tracker";

export interface LLMResponse<T> {
  data: T;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  latency_ms: number;
}

// Map OpenRouter-style model names to Anthropic SDK model IDs
function toAnthropicModelId(model: string): string {
  // Strip "anthropic/" prefix if present (legacy OpenRouter format)
  const base = model.replace(/^anthropic\//, "");
  // Convert dots to hyphens: claude-sonnet-4.6 → claude-sonnet-4-6
  return base.replace(/\./g, "-");
}

// Strip markdown code fences from LLM response
function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

// Extract first JSON object from text
function extractJsonObject(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

// Parse JSON with recovery chain
function parseJsonResponse(raw: string): unknown {
  // Try direct parse
  try {
    return JSON.parse(raw);
  } catch {
    // noop
  }

  // Try stripping code fences
  const stripped = stripCodeFences(raw);
  try {
    return JSON.parse(stripped);
  } catch {
    // noop
  }

  // Try extracting JSON object via regex
  const extracted = extractJsonObject(stripped);
  if (extracted) {
    try {
      return JSON.parse(extracted);
    } catch {
      // noop
    }
  }

  throw new Error("Failed to parse JSON from LLM response");
}

export async function callOpenRouter<T>(options: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  analysisId: string;
  tier: "extraction" | "intelligence";
  signal?: AbortSignal;
  maxRetries?: number;
}): Promise<LLMResponse<T>> {
  const {
    model,
    systemPrompt,
    userPrompt,
    schema,
    analysisId,
    tier,
    signal,
    maxRetries = 1,
  } = options;

  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set. Add it to your .env file.");
  }

  const anthropicModel = toAnthropicModelId(model);

  // Per-tier request timeout: 2 min for extraction, 5 min for intelligence
  const timeoutMs = tier === "extraction" ? 120_000 : 300_000;

  const client = new Anthropic({ apiKey });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();

    const userMessages: Anthropic.MessageParam[] =
      attempt === 0
        ? [{ role: "user", content: userPrompt }]
        : [
            { role: "user", content: userPrompt },
            {
              role: "assistant",
              content: "Here is the JSON:",
            },
            {
              role: "user",
              content: `Your previous response had validation errors: ${lastError?.message}. Please fix and return valid JSON matching the schema exactly.`,
            },
          ];

    let response: Anthropic.Message;
    try {
      response = await client.messages.create(
        {
          model: anthropicModel,
          max_tokens: 16384,
          system: systemPrompt,
          messages: userMessages,
        },
        {
          timeout: timeoutMs,
          signal: signal,
        },
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Analysis cancelled");
      }
      if (
        err instanceof Anthropic.APIConnectionTimeoutError ||
        (err instanceof Error && err.message.includes("timed out"))
      ) {
        throw new Error(
          `Anthropic request timed out after ${timeoutMs / 1000}s`,
        );
      }
      // Re-throw API errors with useful message
      if (err instanceof Anthropic.APIError) {
        throw new Error(`Anthropic API error (${err.status}): ${err.message}`);
      }
      throw err;
    }

    const latencyMs = Date.now() - startTime;

    // Extract text content from response
    const textBlock = response.content.find((b) => b.type === "text");
    const rawContent = textBlock?.type === "text" ? textBlock.text : null;
    if (!rawContent) {
      throw new Error("Empty response from Anthropic");
    }

    const usage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    };

    // Track cost
    const pricing = MODEL_PRICING[model] ?? MODEL_PRICING.default;
    const cost =
      (usage.input_tokens / 1_000_000) * pricing.input_per_million +
      (usage.output_tokens / 1_000_000) * pricing.output_per_million;

    trackCost({
      analysis_id: analysisId,
      timestamp: new Date().toISOString(),
      tier,
      model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_total: cost,
      latency_ms: latencyMs,
    });

    // Parse and validate
    try {
      const parsed = parseJsonResponse(rawContent);
      const validated = schema.parse(parsed);
      return { data: validated, usage, latency_ms: latencyMs };
    } catch (err) {
      lastError =
        err instanceof z.ZodError
          ? new Error(
              err.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; "),
            )
          : err instanceof Error
            ? err
            : new Error("Unknown validation error");

      if (attempt === maxRetries) {
        throw new Error(
          `LLM output validation failed after ${maxRetries + 1} attempts: ${lastError.message}`,
        );
      }
    }
  }

  throw lastError ?? new Error("Unexpected error in callLLM");
}
