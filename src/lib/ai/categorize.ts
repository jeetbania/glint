import { type AiSettings, effectiveModel } from "@/lib/ai/settings";

export type CategorizeResult = { tags: string[]; title: string | null };

const PROMPT = `Look at this image and suggest 2-4 short, lowercase tags (single words or short phrases, like "receipt", "code", "nature photo", "ui design", "meme", "screenshot of a document") that describe what it shows or what it's for. If it clearly has no obvious title of its own, also suggest a short 3-6 word title; otherwise leave title as null.

Respond with ONLY a JSON object, no other text, no markdown fences:
{"tags": ["...", "..."], "title": "..." or null}`;

/** Best-effort parse — providers occasionally wrap JSON in prose or a
 * markdown fence despite being asked not to, so this pulls out the
 * first {...} block rather than assuming the whole response is clean
 * JSON. Never throws; a response that can't be parsed just yields no
 * suggestions instead of breaking the save it's attached to. */
function parseResult(raw: string): CategorizeResult {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw);
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t: unknown) => typeof t === "string").slice(0, 4)
      : [];
    const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : null;
    return { tags, title };
  } catch {
    return { tags: [], title: null };
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function categorizeWithOpenAi(blob: Blob, settings: AiSettings): Promise<CategorizeResult> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
  const base64 = await blobToBase64(blob);
  const res = await client.chat.completions.create({
    model: effectiveModel(settings),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: `data:${blob.type};base64,${base64}` } },
        ],
      },
    ],
    max_tokens: 200,
  });
  return parseResult(res.choices[0]?.message?.content ?? "");
}

/** Any OpenAI-compatible chat-completions endpoint — OpenRouter, NVIDIA
 * NIM, a local Ollama/LM Studio server, etc. — via the OpenAI SDK with
 * baseURL overridden, since that's the API shape all of these actually
 * implement (including the `image_url` vision content-block format).
 * Not every such endpoint supports vision models; a plain-text model
 * picked here will just fail the request, same as picking a non-vision
 * OpenAI model would. */
async function categorizeWithCustom(blob: Blob, settings: AiSettings): Promise<CategorizeResult> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseUrl.trim(),
    dangerouslyAllowBrowser: true,
  });
  const base64 = await blobToBase64(blob);
  const res = await client.chat.completions.create({
    model: effectiveModel(settings),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: `data:${blob.type};base64,${base64}` } },
        ],
      },
    ],
    max_tokens: 200,
  });
  return parseResult(res.choices[0]?.message?.content ?? "");
}

async function categorizeWithAnthropic(blob: Blob, settings: AiSettings): Promise<CategorizeResult> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
  const base64 = await blobToBase64(blob);
  const mediaType = blob.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const res = await client.messages.create({
    model: effectiveModel(settings),
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });
  const textBlock = res.content.find((b) => b.type === "text");
  return parseResult(textBlock && "text" in textBlock ? textBlock.text : "");
}

async function categorizeWithGoogle(blob: Blob, settings: AiSettings): Promise<CategorizeResult> {
  const { GoogleGenAI } = await import("@google/genai");
  const client = new GoogleGenAI({ apiKey: settings.apiKey });
  const base64 = await blobToBase64(blob);
  const res = await client.models.generateContent({
    model: effectiveModel(settings),
    contents: [
      {
        role: "user",
        parts: [{ text: PROMPT }, { inlineData: { mimeType: blob.type, data: base64 } }],
      },
    ],
  });
  return parseResult(res.text ?? "");
}

/** Sends `blob` to whichever provider is configured and returns
 * suggested tags/title, or null if AI categorization isn't set up (no
 * provider/key) or the call fails for any reason — soft-fail, same as
 * lib/ocr.ts, never something that should block a save. */
export async function categorizeImage(
  blob: Blob,
  settings: AiSettings,
): Promise<CategorizeResult | null> {
  if (!settings.provider || !settings.apiKey.trim()) return null;
  if (settings.provider === "custom" && !settings.baseUrl.trim()) return null;
  try {
    if (settings.provider === "openai") return await categorizeWithOpenAi(blob, settings);
    if (settings.provider === "anthropic") return await categorizeWithAnthropic(blob, settings);
    if (settings.provider === "custom") return await categorizeWithCustom(blob, settings);
    return await categorizeWithGoogle(blob, settings);
  } catch (error) {
    console.error("[ai-categorize] failed", error);
    return null;
  }
}
