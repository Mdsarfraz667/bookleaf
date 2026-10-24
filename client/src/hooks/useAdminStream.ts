import { useEffect, useRef } from "react";
import { TOKEN_KEY } from "../lib/api";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export interface AdminStreamEvent {
  id: string;
  [key: string]: unknown;
}

interface Handlers {
  onUpdated?: (data: AdminStreamEvent) => void;
  onNew?: (data: AdminStreamEvent) => void;
}

/** Subscribe to the admin SSE channel. Token is passed via query param. */
export function useAdminStream(handlers: Handlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const url = `${baseURL}/api/admin/events/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    const parse = (event: MessageEvent): AdminStreamEvent | null => {
      try {
        return JSON.parse(event.data) as AdminStreamEvent;
      } catch {
        return null;
      }
    };

    const onUpdated = (event: MessageEvent) => {
      const data = parse(event);
      if (data) handlersRef.current.onUpdated?.(data);
    };
    const onNew = (event: MessageEvent) => {
      const data = parse(event);
      if (data) handlersRef.current.onNew?.(data);
    };

    source.addEventListener("ticket:updated", onUpdated as EventListener);
    source.addEventListener("ticket:new", onNew as EventListener);

    return () => {
      source.removeEventListener("ticket:updated", onUpdated as EventListener);
      source.removeEventListener("ticket:new", onNew as EventListener);
      source.close();
    };
  }, []);
}
