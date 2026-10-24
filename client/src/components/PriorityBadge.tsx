import type { TicketPriority } from "../lib/types";
import { PRIORITY_LABEL } from "../lib/format";

const STYLES: Record<TicketPriority, string> = {
  CRITICAL: "bg-red-50 text-red-700 ring-red-600/20",
  HIGH: "bg-orange-50 text-orange-700 ring-orange-600/20",
  MEDIUM: "bg-yellow-50 text-yellow-800 ring-yellow-600/20",
  LOW: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

const DOT: Record<TicketPriority, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-slate-400",
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[priority]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[priority]}`} />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
