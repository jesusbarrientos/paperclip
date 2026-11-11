import type {
  ExecutionLocation,
  Machine,
  MachinePairingDescription,
  WorkContextState,
} from "@paperclipai/shared";
import { api } from "./client";

export interface WorkContextRunResult {
  runId: string | null;
  state: WorkContextState;
}

export const machinesApi = {
  list: () => api.get<Machine[]>("/machines"),
  rename: (machineId: string, name: string) =>
    api.patch<Machine>(`/machines/${encodeURIComponent(machineId)}`, { name }),
  revoke: (machineId: string) =>
    api.post<Machine>(`/machines/${encodeURIComponent(machineId)}/revoke`, {}),
  describePairing: (machineId: string, token: string) =>
    api.get<MachinePairingDescription>(
      `/machines/pairings/${encodeURIComponent(machineId)}?token=${encodeURIComponent(token)}`,
    ),
  approvePairing: (machineId: string, token: string, shared: boolean) =>
    api.post<Machine>(`/machines/pairings/${encodeURIComponent(machineId)}/approve`, {
      token,
      ...(shared ? { shared: true } : {}),
    }),
};

export const workContextsApi = {
  get: (issueId: string) =>
    api.get<WorkContextState>(`/issues/${encodeURIComponent(issueId)}/work-context`),
  setLocation: (issueId: string, location: ExecutionLocation) =>
    api.put<WorkContextState>(`/issues/${encodeURIComponent(issueId)}/execution-location`, { location }),
  run: (issueId: string, location: ExecutionLocation) =>
    api.post<WorkContextRunResult>(`/issues/${encodeURIComponent(issueId)}/work-context/run`, { location }),
  handoff: (issueId: string, to: ExecutionLocation) =>
    api.post<WorkContextRunResult>(`/issues/${encodeURIComponent(issueId)}/work-context/handoff`, { to }),
  sync: (issueId: string) =>
    api.post<{ state: WorkContextState }>(`/issues/${encodeURIComponent(issueId)}/work-context/sync`, {}),
};
