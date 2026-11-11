import { describe, expect, it } from "vitest";
import { withWorkContextMove } from "../services/work-context-sync.js";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("withWorkContextMove", () => {
  it("holds a move until the snapshot in flight for the same issue finishes", async () => {
    const upload = deferred();
    const order: string[] = [];
    const snapshot = withWorkContextMove("issue-1", async () => {
      order.push("snapshot:start");
      await upload.promise;
      order.push("snapshot:end");
    });
    const move = withWorkContextMove("issue-1", async () => {
      order.push("move");
    });
    const otherIssue = withWorkContextMove("issue-2", async () => {
      order.push("other-issue");
    });

    await otherIssue;
    expect(order).toEqual(["snapshot:start", "other-issue"]);
    upload.resolve();
    await Promise.all([snapshot, move]);
    expect(order).toEqual(["snapshot:start", "other-issue", "snapshot:end", "move"]);
  });

  it("lets the next move run after a failed snapshot without an unhandled rejection", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const upload = deferred();
      const snapshot = withWorkContextMove("issue-3", () => upload.promise);
      const move = withWorkContextMove("issue-3", async () => "moved");
      upload.reject(new Error("machine went offline"));
      await expect(snapshot).rejects.toThrow("machine went offline");
      await expect(move).resolves.toBe("moved");
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});
