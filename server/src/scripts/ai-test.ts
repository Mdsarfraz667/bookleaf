/**
 * Throwaway manual test for the AI layer.
 *   AI_ENABLED=true  ANTHROPIC_API_KEY=<your-key> ./node_modules/.bin/tsx src/scripts/ai-test.ts
 *   AI_ENABLED=false                               ./node_modules/.bin/tsx src/scripts/ai-test.ts   (fallback/null, no API calls)
 */
import "dotenv/config";
import { aiAvailable } from "../services/ai/client";
import { classifyTicket } from "../services/ai/classify";
import { generateDraft } from "../services/ai/draft";
import type { BookFacts, DraftInput } from "../services/ai/prompts";

const sampleBook: BookFacts = {
  title: "Whispers of the Ganges",
  status: "Published & Live",
  isbn: "978-93-5XXXX-01-1",
  genre: "Literary Fiction",
  mrp: 399,
  royaltyPaid: 8400,
  royaltyPending: 3570,
  lastPayoutDate: "2025-10-15",
  availableOn: ["Amazon India", "Flipkart", "BookLeaf Store"],
};

const cases: Array<{ label: string; ticket: { subject: string; description: string }; book: BookFacts | null }> = [
  {
    label: "Royalty — expect ROYALTY_PAYMENTS + CRITICAL/HIGH",
    ticket: {
      subject: "No royalty received in 6 months",
      description:
        "I published my book months ago and still haven't received any royalty payment at all. What is going on? This is money I'm owed.",
    },
    book: sampleBook,
  },
  {
    label: "Bio update — expect GENERAL_INQUIRY + LOW",
    ticket: {
      subject: "Update my author bio",
      description: "Can I update my author bio on my profile? I'd like to refresh the wording.",
    },
    book: null,
  },
  {
    label: "ISBN mismatch — expect ISBN_METADATA + HIGH",
    ticket: {
      subject: "Wrong ISBN on Amazon",
      description:
        "My book is showing a different ISBN on Amazon than what's printed on the physical copy. Please fix this.",
    },
    book: sampleBook,
  },
];

async function main(): Promise<void> {
  console.log(`aiAvailable(): ${aiAvailable()}\n`);

  for (const testCase of cases) {
    console.log("=".repeat(72));
    console.log(testCase.label);
    console.log(`Subject: ${testCase.ticket.subject}`);

    const classification = await classifyTicket(testCase.ticket);
    console.log("classifyTicket →", JSON.stringify(classification));

    const draftInput: DraftInput = {
      author: { name: "Priya Sharma" },
      ticket: { ...testCase.ticket, category: classification.category },
      book: testCase.book,
    };
    const draft = await generateDraft(draftInput);
    console.log("\ngenerateDraft →");
    console.log(draft ? draft.draft : "(null — AI disabled or failed; admin writes manually)");
    console.log();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
