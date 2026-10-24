import type Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, PRIORITIES, type Category, type Priority } from "./knowledgeBase";
import { aiAvailable, createMessage, MODEL } from "./client";
import { buildClassifyUserMessage, CLASSIFY_SYSTEM_TEXT, type TicketInput } from "./prompts";

export interface Classification {
  category: Category;
  priority: Priority;
  aiClassified: boolean;
  reasoning: string | null;
}

/** Safe default used whenever AI is disabled or anything goes wrong. */
const FALLBACK: Classification = {
  category: "GENERAL_INQUIRY",
  priority: "MEDIUM",
  aiClassified: false,
  reasoning: null,
};

// Structured output: the model must call this tool rather than emit free text.
const CLASSIFY_TOOL: Anthropic.Tool = {
  name: "classify_ticket",
  description: "Record the category and priority for a BookLeaf support ticket.",
  input_schema: {
    type: "object",
    properties: {
      category: { type: "string", enum: [...CATEGORIES] },
      priority: { type: "string", enum: [...PRIORITIES] },
      reasoning: { type: "string", description: "One short sentence justifying the choice." },
    },
    required: ["category", "priority", "reasoning"],
  },
};

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && (PRIORITIES as readonly string[]).includes(value);
}

/**
 * Classify a ticket via Anthropic tool-use. Never throws: on any error, timeout,
 * disabled AI, or malformed output it returns the safe fallback.
 */
export async function classifyTicket(ticket: TicketInput): Promise<Classification> {
  if (!aiAvailable()) return FALLBACK;

  try {
    const message = await createMessage({
      model: MODEL,
      max_tokens: 200,
      system: CLASSIFY_SYSTEM_TEXT,
      tools: [CLASSIFY_TOOL],
      tool_choice: { type: "tool", name: "classify_ticket", disable_parallel_tool_use: true },
      messages: [{ role: "user", content: buildClassifyUserMessage(ticket) }],
    });

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === "tool_use" && block.name === "classify_ticket"
    );
    if (!toolUse) return FALLBACK;

    const input = toolUse.input as Record<string, unknown>;
    if (!isCategory(input.category) || !isPriority(input.priority)) return FALLBACK;

    return {
      category: input.category,
      priority: input.priority,
      aiClassified: true,
      reasoning: typeof input.reasoning === "string" ? input.reasoning : null,
    };
  } catch {
    return FALLBACK;
  }
}
