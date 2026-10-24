// Single source of truth for API DTOs on the client. These mirror the server's
// serializers; keep them in sync when the API changes.

export type Role = "ADMIN" | "AUTHOR";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketCategory =
  | "ROYALTY_PAYMENTS"
  | "ISBN_METADATA"
  | "PRINTING_QUALITY"
  | "DISTRIBUTION_AVAILABILITY"
  | "BOOK_STATUS_PRODUCTION"
  | "GENERAL_INQUIRY";
export type TicketPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type SenderType = "AUTHOR" | "ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  externalId?: string;
  city?: string | null;
}

export interface Book {
  id: string;
  externalId: string;
  title: string;
  isbn: string | null;
  genre: string | null;
  publicationDate: string | null;
  status: string;
  mrp: number | null;
  royaltyPerCopy: number | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: number;
  royaltyPaid: number;
  royaltyPending: number;
  lastPayoutDate: string | null;
  printPartner: string | null;
  availableOn: string[];
  inProduction: boolean;
}

export interface TicketBookRef {
  id: string;
  externalId: string;
  title: string;
  status: string;
}

export interface Message {
  id: string;
  senderType: SenderType;
  body: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface TicketAuthorView {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  category: TicketCategory;
  priority: TicketPriority;
  bookId: string | null;
  book: TicketBookRef | null;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  attachments: Attachment[];
}

export interface TicketListRow {
  id: string;
  subject: string;
  status: TicketStatus;
  category: TicketCategory;
  priority: TicketPriority;
  aiClassified: boolean;
  assignedAdminId: string | null;
  authorName: string;
  authorId: string;
  bookTitle: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InternalNote {
  id: string;
  body: string;
  createdAt: string;
  adminId: string;
  admin: { id: string; name: string };
}

export interface AdminMessage extends Message {
  adminId: string | null;
}

export interface TicketAdminView extends TicketAuthorView {
  categoryOverridden: boolean;
  priorityOverridden: boolean;
  aiClassified: boolean;
  aiReasoning: string | null;
  aiDraft: string | null;
  aiDraftModel: string | null;
  assignedAdminId: string | null;
  assignedAdmin: { id: string; name: string; email: string } | null;
  author: { id: string; externalId: string; name: string; email: string; city: string | null };
  internalNotes: InternalNote[];
  messages: AdminMessage[];
}

export interface Health {
  ok: boolean;
  ai: { enabled: boolean; model: string };
}

export interface Meta {
  ticketStatuses: TicketStatus[];
  ticketCategories: TicketCategory[];
  ticketPriorities: TicketPriority[];
}

export interface ApiError {
  error: string;
  details?: Array<{ path: string; message: string }>;
}
