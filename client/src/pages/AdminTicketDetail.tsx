import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { CATEGORY_LABEL, formatDateTime, STATUS_LABEL } from "../lib/format";
import { TicketStatusBadge } from "../components/TicketStatusBadge";
import { PriorityBadge } from "../components/PriorityBadge";
import { OverrideControl } from "../components/OverrideControl";
import { InternalNotes } from "../components/InternalNotes";
import { AiDraftPanel } from "../components/AiDraftPanel";
import { useAdminStream } from "../hooks/useAdminStream";
import type { AdminMessage, TicketAdminView, TicketStatus } from "../lib/types";

async function fetchAdminTicket(id: string): Promise<TicketAdminView> {
  const res = await api.get<{ ticket: TicketAdminView }>(`/api/admin/tickets/${id}`);
  return res.data.ticket;
}

function Bubble({ message }: { message: AdminMessage }) {
  const isAuthor = message.senderType === "AUTHOR";
  return (
    <div className={`flex ${isAuthor ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-soft ${
          isAuthor
            ? "rounded-bl-sm border border-slate-200 bg-white text-slate-800"
            : "rounded-br-sm bg-brand-600 text-white"
        }`}
      >
        <p className={`mb-1 text-xs font-medium ${isAuthor ? "text-slate-500" : "text-brand-100"}`}>
          {isAuthor ? "Author" : "BookLeaf Team"} · {formatDateTime(message.createdAt)}
        </p>
        <p className="whitespace-pre-wrap">{message.body}</p>
      </div>
    </div>
  );
}

export function AdminTicketDetail() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();

  const { data: ticket, isLoading, isError, error } = useQuery({
    queryKey: ["admin-ticket", id],
    queryFn: () => fetchAdminTicket(id),
    enabled: Boolean(id),
  });

  useAdminStream({
    onUpdated: (data) => {
      if (data.id === id) queryClient.invalidateQueries({ queryKey: ["admin-ticket", id] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: TicketStatus) => {
      await api.patch(`/api/admin/tickets/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/admin/tickets/${id}`, { assignToMe: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
  });

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
        <Link to="/admin" className="mt-2 inline-block text-slate-800 underline">
          Back to the queue
        </Link>
      </div>
    );
  }
  if (!ticket) return null;

  return (
    <div>
      <Link to="/admin" className="text-sm text-slate-500 hover:text-slate-800">
        ← Back to the queue
      </Link>

      <div className="mt-3 grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-5 lg:col-span-2">
          <div className="card p-6">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
              <div>
                <h1 className="text-lg font-semibold text-slate-900">{ticket.subject}</h1>
                <p className="mt-1 text-xs text-slate-500">
                  {ticket.author.name} ({ticket.author.email}) ·{" "}
                  {ticket.book ? ticket.book.title : "General / Account"} · {formatDateTime(ticket.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PriorityBadge priority={ticket.priority} />
                <TicketStatusBadge status={ticket.status} />
              </div>
            </div>

            {ticket.book && (
              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                Book: <span className="font-medium text-slate-700">{ticket.book.title}</span> ·{" "}
                {ticket.book.externalId} · {ticket.book.status}
              </div>
            )}

            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Original query</p>
              <p className="whitespace-pre-wrap">{ticket.description}</p>
            </div>
          </div>

          <div className="space-y-3">
            {ticket.messages.length === 0 ? (
              <p className="text-center text-sm text-slate-500">No replies yet.</p>
            ) : (
              ticket.messages.map((message) => <Bubble key={message.id} message={message} />)
            )}
          </div>

          <AiDraftPanel ticket={ticket} />
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Triage</h3>
            <OverrideControl ticket={ticket} />

            <div className="mt-4">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
              <select
                value={ticket.status}
                disabled={statusMutation.isPending}
                onChange={(e) => statusMutation.mutate(e.target.value as TicketStatus)}
                className="input-field mt-1.5 py-1.5"
              >
                {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                {ticket.assignedAdmin ? `Assigned to ${ticket.assignedAdmin.name}` : "Unassigned"}
              </span>
              <button
                onClick={() => assignMutation.mutate()}
                disabled={assignMutation.isPending}
                className="btn-secondary shrink-0 px-2.5 py-1 text-xs"
              >
                Assign to me
              </button>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">AI classification</h3>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Category</dt>
                <dd className="font-medium text-slate-800">{CATEGORY_LABEL[ticket.category]}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Priority</dt>
                <dd className="font-medium text-slate-800">{ticket.priority}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Auto-classified</dt>
                <dd className="font-medium text-slate-800">{ticket.aiClassified ? "Yes" : "No (needs review)"}</dd>
              </div>
            </dl>
            {ticket.aiReasoning && (
              <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                {ticket.aiReasoning}
              </p>
            )}
          </div>

          <div className="card p-4">
            <InternalNotes ticketId={ticket.id} notes={ticket.internalNotes} />
          </div>
        </div>
      </div>
    </div>
  );
}
