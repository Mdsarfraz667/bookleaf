import type { TicketStatus } from "../lib/types";
import { STATUS_LABEL } from "../lib/format";

const STYLES: Record<TicketStatus, string> = {
  OPEN: "bg-blue-50 text-blue-700 ring-blue-600/20",
  IN_PROGRESS: "bg-amber-50 text-amber-700 ring-amber-600/20",
  RESOLVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CLOSED: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

const DOT: Record<TicketStatus, string> = {
  OPEN: "bg-blue-500",
  IN_PROGRESS: "bg-amber-500",
  RESOLVED: "bg-emerald-500",
  CLOSED: "bg-slate-400",
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}
