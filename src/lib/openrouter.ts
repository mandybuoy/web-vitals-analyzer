// OpenRouter API client (OpenAI-compatible chat completions)

import { z } from "zod";
import { getOpenRouterApiKey, MODEL_PRICING } from "./config";
import { trackCost } from "./cost-tracker";

export interface LLMResponse<T> {
  data: T;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  latency_ms: number;
}

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterChoice {
  message: {
    content: string;
  };
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
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

  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not set. Add it to your .env file.");
  }

  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();

    const requestBody: Record<string, unknown> = {
      model,
      messages:
        attempt === 0
          ? messages
          : [
              ...messages,
              {
                role: "user",
                content: `Your previous response had validation errors: ${lastError?.message}. Please fix and return valid JSON matching the schema exactly.`,
              },
            ],
    };

    // Try with response_format first
    if (attempt === 0) {
      requestBody.response_format = { type: "json_object" };
    }

    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://vitalscan.dev",
          "X-Title": "VitalScan",
        },
        body: JSON.stringify(requestBody),
        signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Analysis cancelled");
      }
      throw err;
    }

    // Handle 400 from json_mode not supported — retry without it
    if (response.status === 400 && attempt === 0) {
      delete requestBody.response_format;
      const retryResponse = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://vitalscan.dev",
            "X-Title": "VitalScan",
          },
          body: JSON.stringify(requestBody),
          signal,
        },
      );
      response = retryResponse;
    }

    // Handle rate limiting with exponential backoff
    if (response.status === 429) {
      const backoffMs = Math.min(2000 * Math.pow(2, attempt), 8000);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      continue;
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `OpenRouter API error (${response.status}): ${errorBody}`,
      );
    }

    const result: OpenRouterResponse = await response.json();
    const latencyMs = Date.now() - startTime;

    const rawContent = result.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error("Empty response from OpenRouter");
    }

    const usage = {
      input_tokens: result.usage?.prompt_tokens ?? 0,
      output_tokens: result.usage?.completion_tokens ?? 0,
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

  throw lastError ?? new Error("Unexpected error in callOpenRouter");
}
