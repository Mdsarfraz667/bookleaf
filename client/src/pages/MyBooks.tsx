import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatDate, formatINR } from "../lib/format";
import { EmptyState } from "../components/EmptyState";
import type { Book } from "../lib/types";

async function fetchBooks(): Promise<Book[]> {
  const res = await api.get<{ books: Book[] }>("/api/books");
  return res.data.books;
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function BookCard({ book }: { book: Book }) {
  return (
    <div className="card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{book.title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{book.genre ?? "—"}</p>
        </div>
        {book.inProduction && (
          <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-600/20">
            In Production
          </span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <Figure label="ISBN" value={book.isbn ?? "Not assigned"} />
        <Figure label="Status" value={book.status} />
        <Figure label="Published" value={formatDate(book.publicationDate)} />
        <Figure label="MRP" value={formatINR(book.mrp)} />
      </dl>

      {book.inProduction ? (
        <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Royalty details will be available once this book is published and live.
        </p>
      ) : (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4">
          <Figure label="Copies sold" value={book.totalCopiesSold.toLocaleString("en-IN")} />
          <Figure label="Royalty earned" value={formatINR(book.totalRoyaltyEarned)} />
          <Figure label="Royalty paid" value={formatINR(book.royaltyPaid)} />
          <Figure label="Royalty pending" value={formatINR(book.royaltyPending)} />
        </dl>
      )}
    </div>
  );
}

function BookCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="skeleton h-5 w-40" />
          <div className="skeleton h-3 w-20" />
        </div>
        <div className="skeleton h-5 w-24 rounded-full" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MyBooks() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });

  if (isLoading) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">My Books</h1>
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <BookCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }
  if (isError) return <p className="text-sm text-red-600">Could not load your books.</p>;

  const books = data ?? [];
  if (books.length === 0) {
    return <EmptyState title="No books yet" message="Your published and in-production titles will appear here." />;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">My Books</h1>
      <div className="grid gap-5 sm:grid-cols-2">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </div>
  );
}
