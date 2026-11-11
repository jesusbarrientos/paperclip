import type { IssueComment } from "./types.js";

export interface ChatMessage {
  id: string;
  clientRequestId: string | null;
  authorType: string;
  authorLabel: string;
  body: string;
  createdAt: string;
  /** Sent from this window and not yet confirmed by the server. */
  pending: boolean;
  failed: boolean;
}

/**
 * Comment thread for one issue. A comment posted from here is shown at once
 * under its clientRequestId and replaced by the server copy when it arrives,
 * whether through the POST response or a later list refresh.
 */
export class CommentThread {
  private readonly confirmed = new Map<string, ChatMessage>();
  private readonly pending = new Map<string, ChatMessage>();

  constructor(private readonly describeAuthor: (comment: IssueComment) => string) {}

  addPending(clientRequestId: string, body: string, now = new Date()) {
    this.pending.set(clientRequestId, {
      id: `pending:${clientRequestId}`,
      clientRequestId,
      authorType: "user",
      authorLabel: "You",
      body,
      createdAt: now.toISOString(),
      pending: true,
      failed: false,
    });
  }

  markFailed(clientRequestId: string) {
    const message = this.pending.get(clientRequestId);
    if (message) message.failed = true;
  }

  pendingBody(clientRequestId: string) {
    return this.pending.get(clientRequestId)?.body ?? null;
  }

  upsert(comments: IssueComment[]) {
    for (const comment of comments) {
      this.confirmed.set(comment.id, {
        id: comment.id,
        clientRequestId: comment.clientRequestId ?? null,
        authorType: comment.authorType,
        authorLabel: this.describeAuthor(comment),
        body: comment.body,
        createdAt: typeof comment.createdAt === "string" ? comment.createdAt : new Date(comment.createdAt).toISOString(),
        pending: false,
        failed: false,
      });
      if (comment.clientRequestId) this.pending.delete(comment.clientRequestId);
    }
  }

  messages(): ChatMessage[] {
    const confirmed = [...this.confirmed.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const pending = [...this.pending.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return [...confirmed, ...pending];
  }
}
