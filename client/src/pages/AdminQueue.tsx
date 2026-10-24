import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { CATEGORY_LABEL, formatDateTime } from "../lib/format";
import { TicketStatusBadge } from "../components/TicketStatusBadge";
import { PriorityBadge } from "../components/PriorityBadge";
import { EmptyState } from "../components/EmptyState";
import { FilterBar, type QueueFilters } from "../components/FilterBar";
import { useAdminStream } from "../hooks/useAdminStream";
import type { TicketListRow } from "../lib/types";

async function fetchAdminTickets(filters: QueueFilters): Promise<TicketListRow[]> {
  const params: Record<string, string> = { sort: filters.sort };
  if (filters.status) params.status = filters.status;
  if (filters.category) params.category = filters.category;
  if (filters.priority) params.priority = filters.priority;
  if (filters.q) params.q = filters.q;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = `${filters.to}T23:59:59`; // inclusive end-of-day
  const res = await api.get<{ tickets: TicketListRow[] }>("/api/admin/tickets", { params });
  return res.data.tickets;
}

function ageInDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function rowAccent(row: TicketListRow): string {
  if (row.priority === "CRITICAL") return "border-l-4 border-red-500";
  if (row.priority === "HIGH") return "border-l-4 border-orange-400";
  return "border-l-4 border-transparent";
}

export function AdminQueue() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<QueueFilters>({ sort: "urgent" });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-tickets", filters],
    queryFn: () => fetchAdminTickets(filters),
  });

  // Live queue: any new or updated ticket refreshes the list.
  useAdminStream({
    onNew: () => queryClient.invalidateQueries({ queryKey: ["admin-tickets"] }),
    onUpdated: () => queryClient.invalidateQueries({ queryKey: ["admin-tickets"] }),
  });

  const tickets = useMemo(() => data ?? [], [data]);

  return (
    <div>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight text-slate-900">Ticket Queue</h1>
      <FilterBar filters={filters} onChange={setFilters} />

      {isLoading ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <div className="skeleton h-5 w-20 shrink-0 rounded-full" />
                <div className="w-full space-y-2">
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton h-3 w-1/4" />
                </div>
                <div className="skeleton h-5 w-16 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : isError ? (
        <p className="text-sm text-red-600">Could not load the queue.</p>
      ) : tickets.length === 0 ? (
        <EmptyState title="No tickets match" message="Try clearing or adjusting the filters." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-soft">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Priority</th>
                <th className="px-4 py-2.5 font-semibold">Subject</th>
                <th className="px-4 py-2.5 font-semibold">Author</th>
                <th className="px-4 py-2.5 font-semibold">Category</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((ticket) => {
                const days = ageInDays(ticket.createdAt);
                const unresolved = ticket.status === "OPEN" || ticket.status === "IN_PROGRESS";
                const stale = unresolved && days >= 3;
                return (
                  <tr
                    key={ticket.id}
                    onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                    className={`cursor-pointer transition-colors odd:bg-white even:bg-slate-50/50 hover:bg-brand-50/60 ${rowAccent(ticket)}`}
                  >
                    <td className="px-4 py-3">
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{ticket.subject}</span>
                        {!ticket.aiClassified && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Needs review
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">{ticket.bookTitle ?? "General / Account"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{ticket.authorName}</td>
                    <td className="px-4 py-3 text-slate-600">{CATEGORY_LABEL[ticket.category]}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TicketStatusBadge status={ticket.status} />
                        {ticket.assignedAdminId && (
                          <span className="text-xs text-brand-500" title="Assigned">
                            ●
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          stale
                            ? "inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700"
                            : "text-slate-500"
                        }
                      >
                        {days === 0 ? "Today" : `${days}d`}
                      </span>
                      <div className="text-xs text-slate-400">{formatDateTime(ticket.createdAt)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
