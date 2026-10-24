import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../lib/api";
import { formatDateTime } from "../lib/format";
import type { InternalNote } from "../lib/types";

export function InternalNotes({ ticketId, notes }: { ticketId: string; notes: InternalNote[] }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: async (text: string) => {
      await api.post(`/api/admin/tickets/${ticketId}/notes`, { body: text });
    },
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["admin-ticket", ticketId] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (trimmed) mutation.mutate(trimmed);
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800">Internal notes</h3>
      <p className="mb-2 text-xs text-slate-400">Only visible to the BookLeaf team.</p>

      {notes.length === 0 ? (
        <p className="text-xs text-slate-400">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-slate-700">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {note.admin.name} · {formatDateTime(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="mt-3">
        <textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add an internal note…"
          className="input-field"
        />
        {mutation.isError && (
          <p className="mt-1 text-xs text-red-600">{errorMessage(mutation.error, "Could not add note")}</p>
        )}
        <button type="submit" disabled={mutation.isPending || !body.trim()} className="btn-secondary mt-2 px-3 py-1.5">
          {mutation.isPending ? "Adding…" : "Add note"}
        </button>
      </form>
    </div>
  );
}
