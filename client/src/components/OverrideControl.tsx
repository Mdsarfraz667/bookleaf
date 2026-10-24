import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../lib/api";
import { CATEGORY_LABEL, PRIORITY_LABEL } from "../lib/format";
import type { TicketAdminView, TicketCategory, TicketPriority } from "../lib/types";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as TicketCategory[];
const PRIORITIES = Object.keys(PRIORITY_LABEL) as TicketPriority[];

const selectClass = "input-field mt-1.5 py-1.5";

export function OverrideControl({ ticket }: { ticket: TicketAdminView }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (body: { category?: TicketCategory; priority?: TicketPriority }) => {
      const res = await api.patch<{ ticket: TicketAdminView }>(`/api/admin/tickets/${ticket.id}`, body);
      return res.data.ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ticket", ticket.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
  });

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Category</label>
          {ticket.categoryOverridden && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 ring-1 ring-inset ring-brand-600/20">
              overridden
            </span>
          )}
        </div>
        <select
          value={ticket.category}
          disabled={mutation.isPending}
          onChange={(e) => mutation.mutate({ category: e.target.value as TicketCategory })}
          className={selectClass}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Priority</label>
          {ticket.priorityOverridden && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 ring-1 ring-inset ring-brand-600/20">
              overridden
            </span>
          )}
        </div>
        <select
          value={ticket.priority}
          disabled={mutation.isPending}
          onChange={(e) => mutation.mutate({ priority: e.target.value as TicketPriority })}
          className={selectClass}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
      </div>

      {mutation.isError && (
        <p className="text-xs text-red-600">{errorMessage(mutation.error, "Could not update")}</p>
      )}
    </div>
  );
}
