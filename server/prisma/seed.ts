import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

const bookSchema = z.object({
  book_id: z.string().min(1),
  title: z.string().min(1),
  isbn: z.string().nullable(),
  genre: z.string().nullable(),
  publication_date: z.string().nullable(),
  status: z.string().min(1),
  mrp: z.number().int().nullable(),
  author_royalty_per_copy: z.number().int().nullable(),
  total_copies_sold: z.number().int(),
  total_royalty_earned: z.number().int(),
  royalty_paid: z.number().int(),
  royalty_pending: z.number().int(),
  last_royalty_payout_date: z.string().nullable(),
  print_partner: z.string().nullable(),
  available_on: z.array(z.string()),
});

const authorSchema = z.object({
  author_id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  joined_date: z.string().nullable().optional(),
  books: z.array(bookSchema),
});

const datasetSchema = z.object({
  authors: z.array(authorSchema).length(10),
});

function parseDate(value: string | null | undefined): Date | null {
  if (value == null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date "${value}". Expected YYYY-MM-DD.`);
  }
  return new Date(`${value}T00:00:00.000Z`);
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    throw new Error("SEED_PASSWORD is required.");
  }

  const filePath = join(dirname(fileURLToPath(import.meta.url)), "bookleaf_sample_data.json");
  const dataset = datasetSchema.parse(JSON.parse(readFileSync(filePath, "utf8")));
  const bookCount = dataset.authors.reduce((total, author) => total + author.books.length, 0);
  if (bookCount !== 18) {
    throw new Error(`Expected 18 books in the sample dataset, found ${bookCount}.`);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    await tx.attachment.deleteMany();
    await tx.internalNote.deleteMany();
    await tx.ticketMessage.deleteMany();
    await tx.ticket.deleteMany();
    await tx.book.deleteMany();
    await tx.author.deleteMany();
    await tx.admin.deleteMany();

    for (const author of dataset.authors) {
      const created = await tx.author.create({
        data: {
          externalId: author.author_id,
          name: author.name,
          email: author.email,
          passwordHash,
          phone: author.phone ?? null,
          city: author.city ?? null,
          joinedDate: parseDate(author.joined_date),
        },
      });

      for (const book of author.books) {
        await tx.book.create({
          data: {
            externalId: book.book_id,
            authorId: created.id,
            title: book.title,
            isbn: book.isbn,
            genre: book.genre,
            publicationDate: parseDate(book.publication_date),
            status: book.status,
            mrp: book.mrp,
            royaltyPerCopy: book.author_royalty_per_copy,
            totalCopiesSold: book.total_copies_sold,
            totalRoyaltyEarned: book.total_royalty_earned,
            royaltyPaid: book.royalty_paid,
            royaltyPending: book.royalty_pending,
            lastPayoutDate: parseDate(book.last_royalty_payout_date),
            printPartner: book.print_partner,
            availableOn: book.available_on,
          },
        });
      }
    }

    await tx.admin.create({
      data: {
        name: "BookLeaf Ops",
        email: "ops@bookleaf.com",
        passwordHash,
      },
    });
  }, { timeout: 60_000 });

  const [authors, books, admins, bk013, bk015, bk016] = await Promise.all([
    prisma.author.count(),
    prisma.book.count(),
    prisma.admin.count(),
    prisma.book.findUnique({ where: { externalId: "BK013" } }),
    prisma.book.findUnique({ where: { externalId: "BK015" } }),
    prisma.book.findUnique({ where: { externalId: "BK016" } }),
  ]);

  if (authors !== 10 || books !== 18 || admins !== 1) {
    throw new Error(`Seed counts were ${authors} authors, ${books} books, ${admins} admin.`);
  }
  if (!bk013 || bk013.publicationDate !== null || bk013.mrp !== null) {
    throw new Error("BK013 must exist with null publicationDate and mrp.");
  }
  if (!bk015 || bk015.publicationDate !== null || bk015.mrp !== null) {
    throw new Error("BK015 must exist with null publicationDate and mrp.");
  }
  if (!bk016 || bk016.royaltyPending !== 850) {
    throw new Error("BK016 must exist with royaltyPending 850.");
  }

  console.log(`${authors} authors, ${books} books, ${admins} admin`);
  console.log("Test credentials (password is SEED_PASSWORD):");
  console.log(`  admin: ops@bookleaf.com / ${password}`);
  console.log("  authors:");
  for (const author of dataset.authors) {
    console.log(`    ${author.email} / ${password}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
