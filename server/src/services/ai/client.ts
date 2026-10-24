import Anthropic from "@anthropic-ai/sdk";

/** Model string. Must stay claude-haiku-4-5 unless overridden by env. */
export const MODEL = process.env.AI_MODEL ?? "claude-haiku-4-5";

const REQUEST_TIMEOUT_MS = 15_000;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    // apiKey is read from server-side env only; it never reaches the client bundle.
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      timeout: REQUEST_TIMEOUT_MS,
      // We handle retries ourselves (one retry on 429/5xx) for predictable latency.
      maxRetries: 0,
    });
  }
  return client;
}

/** AI is usable only when enabled AND a key is present. Read lazily so tests can toggle env. */
export function aiAvailable(): boolean {
  return process.env.AI_ENABLED !== "false" && Boolean(process.env.ANTHROPIC_API_KEY);
}

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  if (typeof status === "number") {
    return status === 429 || status >= 500;
  }
  // Connection/timeout errors have no status.
  const name = (error as { name?: string } | null)?.name ?? "";
  return name.includes("Connection") || name.includes("Timeout");
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Create a message with a 15s timeout and exactly one retry on 429/5xx/timeout. */
export async function createMessage(
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await getClient().messages.create(params);
    } catch (error) {
      lastError = error;
      if (attempt === 0 && isRetryable(error)) {
        await delay(400);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/** Concatenate all text blocks from a response. */
export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
