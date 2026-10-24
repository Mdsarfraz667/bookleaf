import type { TicketCategory, TicketPriority, TicketStatus } from "../lib/types";
import { CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "../lib/format";

export type QueueSort = "urgent" | "newest" | "oldest";

export interface QueueFilters {
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  from?: string;
  to?: string;
  q?: string;
  sort: QueueSort;
}

const STATUSES = Object.keys(STATUS_LABEL) as TicketStatus[];
const CATEGORIES = Object.keys(CATEGORY_LABEL) as TicketCategory[];
const PRIORITIES = Object.keys(PRIORITY_LABEL) as TicketPriority[];

const fieldClass =
  "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25";

export function FilterBar({
  filters,
  onChange,
}: {
  filters: QueueFilters;
  onChange: (next: QueueFilters) => void;
}) {
  function set<K extends keyof QueueFilters>(key: K, value: QueueFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="card mb-5 flex flex-wrap items-end gap-3 p-4">
      <label className="flex flex-col gap-1 text-xs text-slate-500">
        Search
        <input
          type="search"
          value={filters.q ?? ""}
          placeholder="Subject or description"
          onChange={(e) => set("q", e.target.value || undefined)}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-500">
        Status
        <select
          value={filters.status ?? ""}
          onChange={(e) => set("status", (e.target.value || undefined) as TicketStatus | undefined)}
          className={fieldClass}
        >
          <option value="">All</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-500">
        Category
        <select
          value={filters.category ?? ""}
          onChange={(e) => set("category", (e.target.value || undefined) as TicketCategory | undefined)}
          className={fieldClass}
        >
          <option value="">All</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-500">
        Priority
        <select
          value={filters.priority ?? ""}
          onChange={(e) => set("priority", (e.target.value || undefined) as TicketPriority | undefined)}
          className={fieldClass}
        >
          <option value="">All</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-500">
        From
        <input
          type="date"
          value={filters.from ?? ""}
          onChange={(e) => set("from", e.target.value || undefined)}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-500">
        To
        <input
          type="date"
          value={filters.to ?? ""}
          onChange={(e) => set("to", e.target.value || undefined)}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-500">
        Sort
        <select
          value={filters.sort}
          onChange={(e) => set("sort", e.target.value as QueueSort)}
          className={fieldClass}
        >
          <option value="urgent">Most urgent</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </label>

      <button onClick={() => onChange({ sort: "urgent" })} className="btn-secondary ml-auto px-3 py-1.5">
        Clear
      </button>
    </div>
  );
}
