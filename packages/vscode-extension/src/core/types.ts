export type {
  ExecutionLocation,
  Machine,
  WorkContext,
  WorkContextState,
} from "@paperclipai/shared/types/machine";

export interface ProjectSummary {
  id: string;
  name: string;
  archivedAt?: string | null;
}

export interface IssueSummary {
  id: string;
  identifier: string | null;
  title: string;
  status: string;
  projectId: string | null;
  assigneeAgentId: string | null;
  assigneeUserId: string | null;
  executionRunId?: string | null;
  updatedAt?: string;
  executionBlocker?: ExecutionBlockerSummary | null;
}

/** The server holds new messages while this is set; they wait until an operator resolves the stopped run. */
export interface ExecutionBlockerSummary {
  runId: string | null;
  agentId: string | null;
  nextAction: string;
  runError: string | null;
  savedMessageCount: number;
}

export interface AgentSummary {
  id: string;
  name: string;
}

export interface IssueComment {
  id: string;
  issueId: string;
  clientRequestId?: string | null;
  authorType: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  body: string;
  createdAt: string;
}

export interface IssueInteraction {
  id: string;
  issueId: string;
  kind: string;
  status: string;
  title?: string | null;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

export interface HeartbeatRun {
  id: string;
  agentId: string;
  status: string;
  error?: string | null;
}

export interface HeartbeatRunEvent {
  runId: string;
  seq: number;
  eventType: string;
  level?: string | null;
  message?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt?: string;
}

export interface LiveEvent {
  id: number;
  type: string;
  createdAt: string;
  replay?: boolean;
  payload: Record<string, unknown>;
}

export const TERMINAL_RUN_STATUSES: ReadonlySet<string> = new Set([
  "succeeded",
  "failed",
  "cancelled",
  "timed_out",
  "interrupted",
]);

export function isTerminalRunStatus(status: string | null | undefined): boolean {
  return status !== null && status !== undefined && TERMINAL_RUN_STATUSES.has(status);
}
