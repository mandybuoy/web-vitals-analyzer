// Model pricing and configuration

export const MODEL_PRICING: Record<
  string,
  { input_per_million: number; output_per_million: number }
> = {
  "anthropic/claude-sonnet-4.6": {
    input_per_million: 3.0,
    output_per_million: 15.0,
  },
  "anthropic/claude-opus-4.6": {
    input_per_million: 15.0,
    output_per_million: 75.0,
  },
  "anthropic/claude-sonnet-4.5": {
    input_per_million: 3.0,
    output_per_million: 15.0,
  },
  "anthropic/claude-opus-4.5": {
    input_per_million: 15.0,
    output_per_million: 75.0,
  },
  "anthropic/claude-3.5-sonnet": {
    input_per_million: 3.0,
    output_per_million: 15.0,
  },
  "anthropic/claude-3.5-haiku": {
    input_per_million: 0.8,
    output_per_million: 4.0,
  },
  "anthropic/claude-haiku-4.5": {
    input_per_million: 0.8,
    output_per_million: 4.0,
  },
  "google/gemini-2.0-flash": {
    input_per_million: 0.1,
    output_per_million: 0.4,
  },
  "openai/gpt-4o": {
    input_per_million: 2.5,
    output_per_million: 10.0,
  },
  default: {
    input_per_million: 5.0,
    output_per_million: 15.0,
  },
};

export const AVAILABLE_MODELS = Object.keys(MODEL_PRICING).filter(
  (k) => k !== "default",
);

export const DEFAULT_EXTRACTION_MODEL = "anthropic/claude-sonnet-4.6";
export const DEFAULT_INTELLIGENCE_MODEL = "anthropic/claude-opus-4.6";

// API key resolution: read from process.env only
export function getGoogleApiKey(): string | undefined {
  return process.env.GOOGLE_PSI_API_KEY;
}

export function getOpenRouterApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY;
}

// Mask a key for display: "sk-abc...WXYZ"
export function maskApiKey(key: string | undefined): string {
  if (!key) return "Not set";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}
