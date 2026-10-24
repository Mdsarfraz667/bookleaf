import { aiAvailable, createMessage, MODEL, textOf } from "./client";
import { buildDraftUserMessage, DRAFT_SYSTEM_TEXT, type DraftInput } from "./prompts";

export interface DraftResult {
  draft: string;
  model: string;
}

/**
 * Generate a KB-grounded draft reply. Returns null when AI is disabled or on any
 * failure — the caller still creates/handles the ticket and admins reply manually.
 * Never throws.
 */
export async function generateDraft(input: DraftInput): Promise<DraftResult | null> {
  if (!aiAvailable()) return null;

  try {
    const message = await createMessage({
      model: MODEL,
      max_tokens: 600,
      // KB lives in the system block with cache_control so repeated draft calls
      // reuse the cached KB tokens instead of re-paying for them each time.
      system: [{ type: "text", text: DRAFT_SYSTEM_TEXT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildDraftUserMessage(input) }],
    });

    const draft = textOf(message);
    if (!draft) return null;

    return { draft, model: MODEL };
  } catch {
    return null;
  }
}
