/** Bring-your-own-key AI settings — stored in this browser's own
 * localStorage only, never sent anywhere but straight to whichever
 * provider the key belongs to, and only when the user has actually
 * opted in. See lib/ai/categorize.ts for what actually calls out. */

export type AiProviderId = "openai" | "anthropic" | "google" | "custom";

export const AI_PROVIDERS: { id: AiProviderId; label: string; defaultModel: string }[] = [
  { id: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini" },
  { id: "anthropic", label: "Anthropic", defaultModel: "claude-3-5-sonnet-latest" },
  { id: "google", label: "Google (Gemini)", defaultModel: "gemini-2.0-flash" },
  // Any OpenAI-compatible chat-completions endpoint — OpenRouter, NVIDIA
  // NIM, a local Ollama/LM Studio server, etc. Sent through the OpenAI
  // SDK with baseUrl overridden (see lib/ai/categorize.ts's
  // categorizeWithCustom) rather than a dedicated client, since that's
  // the API shape all of these actually implement.
  { id: "custom", label: "Custom", defaultModel: "" },
];

export type AiSettings = {
  provider: AiProviderId | null;
  apiKey: string;
  model: string;
  /** Only meaningful when provider === "custom" — the OpenAI-compatible
   * endpoint's base URL, e.g. "https://openrouter.ai/api/v1" or
   * "https://integrate.api.nvidia.com/v1". */
  baseUrl: string;
  /** Off by default — this costs the user's own API credits and sends
   * the image to a third party, so it's never silently switched on. */
  autoCategorize: boolean;
};

const KEY = "glint:ai-settings";

const DEFAULTS: AiSettings = {
  provider: null,
  apiKey: "",
  model: "",
  baseUrl: "",
  autoCategorize: false,
};

export function getAiSettings(): AiSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function setAiSettings(settings: AiSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Quota exceeded or unavailable — nothing to fall back to for a
    // plain string this small, but shouldn't be able to crash the app.
  }
}

export function effectiveModel(settings: AiSettings): string {
  if (settings.model.trim()) return settings.model.trim();
  return AI_PROVIDERS.find((p) => p.id === settings.provider)?.defaultModel ?? "";
}
