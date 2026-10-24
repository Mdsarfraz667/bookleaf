/**
 * BookLeaf policy knowledge base and ticket taxonomy.
 *
 * KNOWLEDGE_BASE is injected into the drafting system prompt (and cached there).
 * The taxonomy + hint strings are small and used for classification so we never
 * ship the full KB on a classify call.
 */

/** The six ticket categories. Keys match the Prisma TicketCategory enum. */
export const CATEGORIES = [
  "ROYALTY_PAYMENTS",
  "ISBN_METADATA",
  "PRINTING_QUALITY",
  "DISTRIBUTION_AVAILABILITY",
  "BOOK_STATUS_PRODUCTION",
  "GENERAL_INQUIRY",
] as const;

/** The four priority levels. Keys match the Prisma TicketPriority enum. */
export const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];

/** Concise, token-cheap guidance to steer classification (no full KB needed). */
export const CATEGORY_HINTS = `ROYALTY_PAYMENTS: royalty amounts, payouts, missing/late/low payments, bank details, statements.
ISBN_METADATA: wrong/duplicate ISBN, mismatched ISBN across platforms, title/author/description metadata errors.
PRINTING_QUALITY: physical defects — misprints, blurry images, binding, color, damaged author copies.
DISTRIBUTION_AVAILABILITY: book "unavailable"/not listed on Amazon/Flipkart/stores, stock sync, where it's for sale.
BOOK_STATUS_PRODUCTION: pre-publication progress — editing, cover design, typesetting, proofreading, "when will it publish".
GENERAL_INQUIRY: anything else — account, bios, general how-to, packages, non-urgent questions.`;

export const PRIORITY_HINTS = `CRITICAL: money clearly owed and long overdue (e.g. no royalty for many months), legal/financial harm, public-facing data errors causing lost sales.
HIGH: ISBN errors (policy: high priority), print defects needing reprint, published book unavailable for sale, payment noticeably overdue.
MEDIUM: general royalty/status questions, production timeline checks, most standard requests.
LOW: cosmetic or informational requests with no urgency (e.g. updating a bio or description).`;

export const KNOWLEDGE_BASE = `BOOKLEAF PUBLISHING — SUPPORT KNOWLEDGE BASE

COMPANY
- Self-publishing company operating in India and the US.
- Packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium paid, marketing + distribution add-ons).
- BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution, and royalty management.
- In-house printing facility and warehouse in Delhi. Print partners: Repro India and Epitome Books.

ROYALTY POLICY
- 80/20 split: 80% of net profit per book to the author, 20% to BookLeaf.
- Net profit = MRP − printing cost − platform commission (Amazon/Flipkart) − shipping charges.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold is ₹1,000; balances below this roll over to the next quarter.
- Payouts are made by bank transfer to the account linked in the author's dashboard.
- A detailed per-platform royalty breakdown is available in the author's dashboard.

ISBN POLICY
- Every BookLeaf book gets a unique ISBN registered under BookLeaf's publisher imprint.
- Authors wanting an ISBN under their own imprint must obtain it independently.
- ISBN errors (duplicate, wrong book linked, mismatched ISBN) are HIGH PRIORITY: escalate to the production team with a 48-hour resolution timeline.

PRINTING & QUALITY
- In-house printing handles most orders; overflow or special formats go to Repro India or Epitome Books.
- Standard print turnaround: 5–7 business days from order confirmation.
- For quality issues (misprints, binding defects, color inconsistency), BookLeaf arranges a FREE reprint after verification; the author may need to share photos of the defective copy. Reprint timeline is 5–7 business days.

DISTRIBUTION & AVAILABILITY
- Channels: Amazon India, Flipkart, Amazon US, Amazon UK, and the BookLeaf Store.
- New listings typically go live within 7–10 business days after publication is complete.
- A book showing "unavailable" on a platform is usually a stock sync issue; the team can trigger a re-sync, live again within 24–48 hours.

PRODUCTION STAGES (in order)
Manuscript Received → Editing (if opted) → Cover Design → Typesetting → Proofreading → ISBN Assignment → Printing → Distribution Setup → Published & Live.
- Authors are updated by email at each stage. Delays usually happen at Cover Design (awaiting author approval) and Proofreading (revision rounds).

TONE & WRITING GUIDELINES (follow these when replying)
- Be empathetic and professional. Authors are partners, not customers to manage.
- Acknowledge the author's concern first, before jumping to the solution.
- Be specific: use actual numbers, dates, and statuses you are given rather than vague reassurance.
- If something is BookLeaf's fault (delayed royalties, ISBN error), own it directly. No corporate deflection.
- When something needs investigation or escalation, give a concrete timeline (e.g. "within 48 hours") rather than an open-ended promise.
- Always end with a clear next step for the author and/or the BookLeaf team.`;
