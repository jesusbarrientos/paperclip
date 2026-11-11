import type { MachineDaemonMessage } from "@paperclipai/shared";

export const OUTBOX_MAX_BYTES = 8 * 1024 * 1024;

interface Entry {
  message: MachineDaemonMessage;
  bytes: number;
}

/**
 * Holds exec/rpc frames produced while the socket is down. When full, the
 * oldest output chunks are dropped; lifecycle frames (started, exited,
 * failed, rpc results) are never dropped because the server needs them to
 * settle each request.
 */
export class MachineOutbox {
  private entries: Entry[] = [];
  private totalBytes = 0;
  private droppedChunks = 0;

  constructor(private readonly maxBytes = OUTBOX_MAX_BYTES) {}

  push(message: MachineDaemonMessage): void {
    const bytes = Buffer.byteLength(JSON.stringify(message));
    this.entries.push({ message, bytes });
    this.totalBytes += bytes;
    if (this.totalBytes <= this.maxBytes) return;
    const kept: Entry[] = [];
    for (const entry of this.entries) {
      if (this.totalBytes > this.maxBytes && entry.message.type === "exec.output") {
        this.totalBytes -= entry.bytes;
        this.droppedChunks += 1;
        continue;
      }
      kept.push(entry);
    }
    this.entries = kept;
  }

  drain(): { messages: MachineDaemonMessage[]; droppedChunks: number } {
    const result = { messages: this.entries.map((entry) => entry.message), droppedChunks: this.droppedChunks };
    this.entries = [];
    this.totalBytes = 0;
    this.droppedChunks = 0;
    return result;
  }

  get size(): number {
    return this.entries.length;
  }

  get bytes(): number {
    return this.totalBytes;
  }
}
