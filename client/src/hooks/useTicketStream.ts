import { useEffect, useRef } from "react";
import { TOKEN_KEY } from "../lib/api";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export interface TicketStreamEvent {
  id: string;
  [key: string]: unknown;
}

interface Handlers {
  onUpdated?: (data: TicketStreamEvent) => void;
  onNew?: (data: TicketStreamEvent) => void;
}

/**
 * Subscribe to the author SSE stream. EventSource can't set headers, so the JWT
 * is passed as a query param (the server accepts ?token= on this route).
 */
export function useTicketStream(handlers: Handlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const url = `${baseURL}/api/tickets/events/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    const parse = (event: MessageEvent): TicketStreamEvent | null => {
      try {
        return JSON.parse(event.data) as TicketStreamEvent;
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
