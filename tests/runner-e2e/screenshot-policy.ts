export const PUBLIC_RUNNER_SCREENSHOT_MARKER = "public-runner-fixture" as const;

export interface PublicRunnerScreenshotTarget {
  chatAgentId?: string;
  issueId: string | null | undefined;
  issueIdentifier: string | null | undefined;
}

export function isPublicRunnerScreenshotRoute(
  url: string,
  target: PublicRunnerScreenshotTarget,
) {
  try {
    if (!target.issueId) return false;
    const candidate = new URL(url);
    const issueReference = target.issueIdentifier ?? target.issueId;
    const expectedPath = `/issues/${encodeURIComponent(issueReference)}`;
    const chatPath = target.chatAgentId ? `/chats/${encodeURIComponent(target.chatAgentId)}` : null;
    return (
      candidate.protocol === "http:" &&
      candidate.hostname === "127.0.0.1" &&
      (candidate.pathname === chatPath ||
        candidate.pathname === expectedPath ||
        candidate.pathname === `${expectedPath}/`)
    );
  } catch {
    return false;
  }
}
