import {
  CATEGORY_HINTS,
  KNOWLEDGE_BASE,
  PRIORITY_HINTS,
  type Category,
} from "./knowledgeBase";

/** Cap free-text we forward to the model so a huge paste can't blow up token cost. */
const MAX_SUBJECT = 200;
const MAX_DESCRIPTION = 2_000;

export interface TicketInput {
  subject: string;
  description: string;
}

export interface BookFacts {
  title: string;
  status: string;
  isbn: string | null;
  genre: string | null;
  mrp: number | null;
  royaltyPaid: number | null;
  royaltyPending: number | null;
  lastPayoutDate: string | null;
  availableOn: string[];
}

export interface DraftInput {
  author: { name: string };
  ticket: TicketInput & { category?: Category | null };
  book: BookFacts | null;
}

function clamp(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

// ---------- Classification ----------

/** Short, static system text for classification. Deliberately excludes the full KB. */
export const CLASSIFY_SYSTEM_TEXT = `You classify incoming author-support tickets for BookLeaf Publishing.
Choose exactly one category and one priority, then call the classify_ticket tool.

CATEGORIES
${CATEGORY_HINTS}

PRIORITIES
${PRIORITY_HINTS}

Judge priority by real urgency and financial/reputational impact, not by tone alone.`;

export function buildClassifyUserMessage(ticket: TicketInput): string {
  return `Subject: ${clamp(ticket.subject, MAX_SUBJECT)}
Description: ${clamp(ticket.description, MAX_DESCRIPTION)}`;
}

// ---------- Drafting ----------

/** Static drafting system text: KB + hard rules. Cacheable because it never varies per ticket. */
export const DRAFT_SYSTEM_TEXT = `You are a BookLeaf Publishing support representative writing a reply to an author.
Use ONLY the knowledge base below and the ticket facts provided in the user message.

${KNOWLEDGE_BASE}

HARD RULES
- Write in BookLeaf's tone: empathetic, specific, and accountable.
- Use ONLY numbers, dates, ISBNs, and statuses that appear in the provided facts. NEVER invent specific figures or dates.
- If the author asks for a specific number/date you were not given, do not guess — promise a concrete follow-up instead (e.g. "we'll confirm the exact figure within 48 hours").
- Keep it concise (a few short paragraphs). End with a clear next step.
- Output ONLY the reply body. No subject line, no preamble, no notes.
- End the message with exactly this line: — The BookLeaf Team`;

export function buildDraftUserMessage(input: DraftInput): string {
  const { author, ticket, book } = input;
  const lines: string[] = [];
  lines.push(`Author: ${author.name}`);
  if (ticket.category) lines.push(`Detected category: ${ticket.category}`);

  if (book) {
    lines.push("", "Relevant book (use only these facts):");
    lines.push(`- Title: ${book.title}`);
    lines.push(`- Status: ${book.status}`);
    lines.push(`- ISBN: ${book.isbn ?? "not assigned yet"}`);
    if (book.genre) lines.push(`- Genre: ${book.genre}`);
    if (book.mrp != null) lines.push(`- MRP: ₹${book.mrp}`);
    if (book.royaltyPaid != null) lines.push(`- Royalty paid to date: ₹${book.royaltyPaid}`);
    if (book.royaltyPending != null) lines.push(`- Royalty pending: ₹${book.royaltyPending}`);
    lines.push(`- Last payout date: ${book.lastPayoutDate ?? "no payout yet"}`);
    lines.push(`- Available on: ${book.availableOn.length ? book.availableOn.join(", ") : "not yet listed"}`);
  } else {
    lines.push("", "This is a general / account-level query (no specific book).");
  }

  lines.push("", "Author's message:");
  lines.push(`Subject: ${clamp(ticket.subject, MAX_SUBJECT)}`);
  lines.push(`Description: ${clamp(ticket.description, MAX_DESCRIPTION)}`);

  return lines.join("\n");
}
