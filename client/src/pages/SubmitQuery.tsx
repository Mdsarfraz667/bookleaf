import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, errorMessage } from "../lib/api";
import type { Book, TicketAuthorView } from "../lib/types";

async function fetchBooks(): Promise<Book[]> {
  const res = await api.get<{ books: Book[] }>("/api/books");
  return res.data.books;
}

interface AttachmentMeta {
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
}

interface CreateTicketPayload {
  subject: string;
  description: string;
  bookId: string | null;
  attachments?: AttachmentMeta[];
}

const GENERAL = "GENERAL";

export function SubmitQuery() {
  const navigate = useNavigate();
  const { data: books } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });

  const [bookId, setBookId] = useState<string>(GENERAL);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: CreateTicketPayload) => {
      const res = await api.post<{ ticket: TicketAuthorView }>("/api/tickets", payload);
      return res.data.ticket;
    },
    onSuccess: (ticket) => navigate(`/tickets/${ticket.id}`),
    onError: (err) => setFormError(errorMessage(err, "Could not submit your query")),
  });

  const bookOptions = useMemo(() => books ?? [], [books]);

  function onFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) {
      setAttachments([]);
      return;
    }
    // UI only: we send file metadata, not the bytes.
    setAttachments(
      Array.from(files).map((file) => ({
        fileName: file.name,
        mimeType: file.type || undefined,
        sizeBytes: file.size,
      }))
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmedSubject = subject.trim();
    const trimmedDescription = description.trim();
    if (!trimmedSubject) return setFormError("Please enter a subject.");
    if (!trimmedDescription) return setFormError("Please describe your query.");

    mutation.mutate({
      subject: trimmedSubject,
      description: trimmedDescription,
      bookId: bookId === GENERAL ? null : bookId,
      attachments: attachments.length ? attachments : undefined,
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">Submit a Support Query</h1>

      <form onSubmit={onSubmit} className="card space-y-5 p-6">
        <div>
          <label htmlFor="book" className="block text-sm font-medium text-slate-700">
            Which book is this about?
          </label>
          <select
            id="book"
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
            className="input-field mt-1.5"
          >
            <option value={GENERAL}>General / Account Level</option>
            {bookOptions.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-slate-700">
            Subject
          </label>
          <input
            id="subject"
            type="text"
            maxLength={200}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="input-field mt-1.5"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-700">
            Description
          </label>
          <textarea
            id="description"
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-field mt-1.5"
          />
        </div>

        <div>
          <label htmlFor="files" className="block text-sm font-medium text-slate-700">
            Attachments <span className="text-slate-400">(optional)</span>
          </label>
          <input
            id="files"
            type="file"
            multiple
            onChange={onFilesChange}
            className="mt-1.5 block w-full cursor-pointer text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
          />
          {attachments.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-slate-500">
              {attachments.map((a) => (
                <li key={a.fileName}>{a.fileName}</li>
              ))}
            </ul>
          )}
        </div>

        {formError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}

        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? "Submitting…" : "Submit query"}
        </button>
      </form>
    </div>
  );
}
