import type {
  CreateSmokeRun,
  RecordSmokeRunStep,
  SmokeLabServiceStatus,
  SmokeRun,
  SmokeRunStep,
  UpdateSmokeRun,
} from "@paperclipai/shared";
import { api } from "./client";

/**
 * Smoke Lab API client (PAP-13347 / S2, plan §D3). Mirrors the S1 results API
 * shipped in `server/src/routes/smoke-lab.ts` (PAP-13346). Every endpoint is
 * company-scoped and gated server-side on `experimental.enableSmokeLab`,
 * `deploymentMode === local_trusted`, and a non-production environment — the UI
 * only ever surfaces these screens when the board-readable experimental flag is
 * on, but the server stays authoritative.
 */

export interface SmokeLabServicesResponse {
  services: SmokeLabServiceStatus[];
}

export interface SmokeLabInstallFixturesResponse {
  created: boolean;
  applications: Array<{ id: string; name: string }>;
  connections: Array<{ id: string; name: string }>;
  catalog: unknown[];
  profile: { id: string };
}

export interface SmokeLabRunsResponse {
  runs: SmokeRun[];
}

export interface SmokeLabRunDetailResponse {
  run: SmokeRun;
  steps: SmokeRunStep[];
}

const base = () => `/smoke-lab`;

export const smokeLabApi = {
  listServices: () =>
    api.get<SmokeLabServicesResponse>(`${base()}/services`),
  startServices: () =>
    api.post<SmokeLabServicesResponse>(`${base()}/services/start`, {}),
  stopServices: () =>
    api.post<SmokeLabServicesResponse>(`${base()}/services/stop`, {}),
  installFixtures: () =>
    api.post<SmokeLabInstallFixturesResponse>(`${base()}/install-fixtures`, {}),
  reset: () =>
    api.post<{ reset: boolean }>(`${base()}/reset`, {}),

  listRuns: () =>
    api.get<SmokeLabRunsResponse>(`${base()}/runs`),
  getRun: (runId: string) =>
    api.get<SmokeLabRunDetailResponse>(`${base()}/runs/${runId}`),
  createRun: (input: CreateSmokeRun) =>
    api.post<{ run: SmokeRun }>(`${base()}/runs`, input),
  updateRun: (runId: string, input: UpdateSmokeRun) =>
    api.patch<{ run: SmokeRun }>(`${base()}/runs/${runId}`, input),
  recordStep: (runId: string, input: RecordSmokeRunStep) =>
    api.post<{ step: SmokeRunStep; summary: Record<string, unknown> }>(
      `${base()}/runs/${runId}/steps`,
      input,
    ),
};
