import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { authenticate, requireRole } from "../middleware/auth";

export const booksRouter: Router = Router();

booksRouter.use(authenticate, requireRole("AUTHOR"));

interface BookRow {
  id: string;
  externalId: string;
  title: string;
  isbn: string | null;
  genre: string | null;
  publicationDate: Date | null;
  status: string;
  mrp: number | null;
  royaltyPerCopy: number | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: number;
  royaltyPaid: number;
  royaltyPending: number;
  lastPayoutDate: Date | null;
  printPartner: string | null;
  availableOn: string[];
}

function serializeBook(book: BookRow) {
  return {
    id: book.id,
    externalId: book.externalId,
    title: book.title,
    isbn: book.isbn,
    genre: book.genre,
    publicationDate: book.publicationDate,
    status: book.status,
    mrp: book.mrp,
    royaltyPerCopy: book.royaltyPerCopy,
    totalCopiesSold: book.totalCopiesSold,
    totalRoyaltyEarned: book.totalRoyaltyEarned,
    royaltyPaid: book.royaltyPaid,
    royaltyPending: book.royaltyPending,
    lastPayoutDate: book.lastPayoutDate,
    printPartner: book.printPartner,
    availableOn: book.availableOn,
    // Derived: books still in production have no publication date yet.
    inProduction: book.publicationDate === null,
  };
}

/** GET /api/books — the authenticated author's own books only. */
booksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const books = await prisma.book.findMany({
      where: { authorId: req.user!.id },
      orderBy: { externalId: "asc" },
    });
    res.json({ books: books.map(serializeBook) });
  })
);
