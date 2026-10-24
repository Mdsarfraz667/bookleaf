import type { Response } from "express";

/**
 * Minimal Server-Sent Events hub.
 *
 * Channels used by this app:
 *   - `author:<authorId>` — one per author, for their own ticket updates.
 *   - `admin`             — the shared admin dashboard feed.
 */

export const ADMIN_CHANNEL = "admin";
export const authorChannel = (authorId: string): string => `author:${authorId}`;

const channels = new Map<string, Set<Response>>();

function safeWrite(res: Response, payload: string): void {
  try {
    res.write(payload);
  } catch {
    // A dead connection is cleaned up on its own 'close' handler.
  }
}

/** Register a response on the given channels. Returns an unsubscribe function. */
export function addClient(channelNames: string[], res: Response): () => void {
  for (const name of channelNames) {
    let set = channels.get(name);
    if (!set) {
      set = new Set();
      channels.set(name, set);
    }
    set.add(res);
  }

  return () => {
    for (const name of channelNames) {
      const set = channels.get(name);
      if (!set) continue;
      set.delete(res);
      if (set.size === 0) channels.delete(name);
    }
  };
}

/** Push a named event with a JSON payload to every client on a channel. */
export function publish(channel: string, event: string, data: unknown): void {
  const set = channels.get(channel);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) safeWrite(res, payload);
}

/** Notify both the owning author and the admin dashboard about a ticket change. */
export function publishTicketEvent(
  ticket: { authorId: string },
  event: string,
  data: unknown
): void {
  publish(authorChannel(ticket.authorId), event, data);
  publish(ADMIN_CHANNEL, event, data);
}

/** Send an SSE comment line, used as a keep-alive heartbeat. */
export function heartbeat(res: Response): void {
  safeWrite(res, ": ping\n\n");
}
