import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { api, errorMessage } from "../lib/api";
import { STATUS_LABEL } from "../lib/format";
import type { TicketAdminView, TicketStatus } from "../lib/types";

interface DraftResponse {
  draft: string;
  model: string | null;
  cached: boolean;
}

const KEEP = "KEEP";

export function AiDraftPanel({ ticket }: { ticket: TicketAdminView }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(ticket.aiDraft ?? "");
  const [unavailable, setUnavailable] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<string>(KEEP);

  async function loadDraft(force: boolean) {
    setError(null);
    setInfo(null);
    try {
      const res = await api.post<DraftResponse>(
        `/api/admin/tickets/${ticket.id}/draft${force ? "?force=true" : ""}`
      );
      setText(res.data.draft);
      setUnavailable(false);
      setInfo(res.data.cached ? "Loaded cached draft." : `Generated with ${res.data.model ?? "AI"}.`);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 503) {
        setUnavailable(true);
      } else {
        setError(errorMessage(err, "Could not generate a draft"));
      }
    }
  }

  const generating = useMutation({ mutationFn: (force: boolean) => loadDraft(force) });

  // On open: if there is no cached draft yet, fetch one.
  useEffect(() => {
    if (!ticket.aiDraft) {
      generating.mutate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);

  const sending = useMutation({
    mutationFn: async () => {
      const body: { body: string; status?: TicketStatus } = { body: text.trim() };
      if (sendStatus !== KEEP) body.status = sendStatus as TicketStatus;
      await api.post(`/api/admin/tickets/${ticket.id}/respond`, body);
    },
    onSuccess: () => {
      setInfo("Response sent to the author.");
      queryClient.invalidateQueries({ queryKey: ["admin-ticket", ticket.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: (err) => setError(errorMessage(err, "Could not send the response")),
  });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 text-brand-500"
            aria-hidden="true"
          >
            <path d="M12 3v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4" />
            <circle cx="12" cy="12" r="4" />
          </svg>
          AI-drafted response
        </h3>
        <button
          onClick={() => generating.mutate(true)}
          disabled={generating.isPending}
          className="btn-secondary px-2.5 py-1 text-xs"
        >
          {generating.isPending ? "Generating…" : "Regenerate"}
        </button>
      </div>

      {unavailable && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          AI unavailable — write the response manually below.
        </p>
      )}

      <textarea
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={generating.isPending ? "Generating a draft…" : "Write a response to the author…"}
        className="input-field mt-3"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Set status
          <select
            value={sendStatus}
            onChange={(e) => setSendStatus(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
          >
            <option value={KEEP}>Keep ({STATUS_LABEL[ticket.status]})</option>
            {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={() => {
            setError(null);
            if (!text.trim()) {
              setError("Please write a response first.");
              return;
            }
            sending.mutate();
          }}
          disabled={sending.isPending}
          className="btn-primary ml-auto"
        >
          {sending.isPending ? "Sending…" : "Send to author"}
        </button>
      </div>

      {info && <p className="mt-2 text-xs text-emerald-700">{info}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
