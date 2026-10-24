import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../lib/api";
import { CATEGORY_LABEL, formatDateTime } from "../lib/format";
import { TicketStatusBadge } from "../components/TicketStatusBadge";
import { PriorityBadge } from "../components/PriorityBadge";
import { useTicketStream } from "../hooks/useTicketStream";
import type { Message, TicketAuthorView } from "../lib/types";

async function fetchTicket(id: string): Promise<TicketAuthorView> {
  const res = await api.get<{ ticket: TicketAuthorView }>(`/api/tickets/${id}`);
  return res.data.ticket;
}

function MessageBubble({ message }: { message: Message }) {
  const isAuthor = message.senderType === "AUTHOR";
  return (
    <div className={`flex ${isAuthor ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-soft ${
          isAuthor
            ? "rounded-br-sm bg-brand-600 text-white"
            : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"
        }`}
      >
        <p className={`mb-1 text-xs font-medium ${isAuthor ? "text-brand-100" : "text-slate-500"}`}>
          {isAuthor ? "You" : "BookLeaf Team"} · {formatDateTime(message.createdAt)}
        </p>
        <p className="whitespace-pre-wrap">{message.body}</p>
      </div>
    </div>
  );
}

export function TicketDetail() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);

  const { data: ticket, isLoading, isError, error } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => fetchTicket(id),
    enabled: Boolean(id),
  });

  // Live updates: when THIS ticket changes (e.g. an admin replies), refetch.
  useTicketStream({
    onUpdated: (data) => {
      if (data.id === id) {
        queryClient.invalidateQueries({ queryKey: ["ticket", id] });
        queryClient.invalidateQueries({ queryKey: ["tickets"] });
      }
    },
  });

  const mutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await api.post<{ ticket: TicketAuthorView }>(`/api/tickets/${id}/messages`, { body });
      return res.data.ticket;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["ticket", id], updated);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setReply("");
    },
    onError: (err) => setReplyError(errorMessage(err, "Could not send your reply")),
  });

  function onReply(e: FormEvent) {
    e.preventDefault();
    setReplyError(null);
    const trimmed = reply.trim();
    if (!trimmed) return setReplyError("Please write a message.");
    mutation.mutate(trimmed);
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
        Loading ticket…
      </div>
    );
  if (isError) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    return (
      <div className="text-sm text-slate-600">
        <p>{status === 404 ? "This ticket was not found." : "Could not load this ticket."}</p>
        <Link to="/tickets" className="mt-2 inline-block text-slate-800 underline">
          Back to my tickets
        </Link>
      </div>
    );
  }
  if (!ticket) return null;

  const closed = ticket.status === "CLOSED";

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/tickets" className="text-sm text-slate-500 hover:text-slate-800">
        ← Back to my tickets
      </Link>

      <div className="card mt-3 p-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{ticket.subject}</h1>
            <p className="mt-1 text-xs text-slate-500">
              {CATEGORY_LABEL[ticket.category]} · {ticket.book ? ticket.book.title : "General / Account"} ·{" "}
              {formatDateTime(ticket.createdAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PriorityBadge priority={ticket.priority} />
            <TicketStatusBadge status={ticket.status} />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Original query</p>
          <p className="whitespace-pre-wrap">{ticket.description}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {ticket.messages.length === 0 ? (
          <p className="text-center text-sm text-slate-500">
            No replies yet. The BookLeaf team will respond soon.
          </p>
        ) : (
          ticket.messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
      </div>

      <form onSubmit={onReply} className="card mt-5 p-4">
        <label htmlFor="reply" className="block text-sm font-medium text-slate-700">
          Add a reply
        </label>
        <textarea
          id="reply"
          rows={3}
          value={reply}
          disabled={closed}
          onChange={(e) => setReply(e.target.value)}
          placeholder={closed ? "This ticket is closed." : "Type your message…"}
          className="input-field mt-1.5 disabled:bg-slate-50 disabled:text-slate-400"
        />
        {replyError && <p className="mt-1 text-sm text-red-600">{replyError}</p>}
        <div className="mt-2 flex justify-end">
          <button type="submit" disabled={closed || mutation.isPending} className="btn-primary">
            {mutation.isPending ? "Sending…" : "Send reply"}
          </button>
        </div>
      </form>
    </div>
  );
}
