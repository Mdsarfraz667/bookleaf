import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { CATEGORY_LABEL, formatDateTime } from "../lib/format";
import { TicketStatusBadge } from "../components/TicketStatusBadge";
import { PriorityBadge } from "../components/PriorityBadge";
import { EmptyState } from "../components/EmptyState";
import type { TicketAuthorView } from "../lib/types";

async function fetchTickets(): Promise<TicketAuthorView[]> {
  const res = await api.get<{ tickets: TicketAuthorView[] }>("/api/tickets");
  return res.data.tickets;
}

export function MyTickets() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({ queryKey: ["tickets"], queryFn: fetchTickets });

  if (isLoading) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">My Tickets</h1>
          <Link to="/submit" className="btn-primary px-3 py-1.5">
            New query
          </Link>
        </div>
        <ul className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="card flex items-center justify-between gap-4 p-4">
              <div className="w-full space-y-2">
                <div className="skeleton h-4 w-1/2" />
                <div className="skeleton h-3 w-3/4" />
              </div>
              <div className="skeleton h-5 w-20 shrink-0 rounded-full" />
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (isError) return <p className="text-sm text-red-600">Could not load your tickets.</p>;

  const tickets = data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">My Tickets</h1>
        <Link to="/submit" className="btn-primary px-3 py-1.5">
          New query
        </Link>
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          title="No tickets yet"
          message="When you submit a support query, it will show up here."
          action={
            <Link to="/submit" className="btn-primary">
              Submit your first query
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                className="card flex w-full items-center justify-between gap-4 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-card-hover"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{ticket.subject}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {CATEGORY_LABEL[ticket.category]} · {ticket.book ? ticket.book.title : "General / Account"} ·{" "}
                    {formatDateTime(ticket.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <PriorityBadge priority={ticket.priority} />
                  <TicketStatusBadge status={ticket.status} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
