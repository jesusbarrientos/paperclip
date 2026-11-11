export { execute } from "./execute.js";
export { testEnvironment } from "./test.js";
export { listOpenRouterModels } from "./models.js";
export { getConfigSchema } from "./config-schema.js";
import type { AdapterSessionCodec } from "@paperclipai/adapter-utils";

export const sessionCodec: AdapterSessionCodec = {
  deserialize(raw: unknown) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    const sessionId =
      typeof record.sessionId === "string" && record.sessionId.trim().length > 0
        ? record.sessionId.trim()
        : null;
    if (!sessionId) return null;
    const cwd =
      typeof record.cwd === "string" && record.cwd.trim().length > 0
        ? record.cwd.trim()
        : null;
    return {
      sessionId,
      ...(cwd ? { cwd } : {}),
    };
  },
  serialize(params: Record<string, unknown> | null) {
    if (!params) return null;
    const sessionId =
      typeof params.sessionId === "string" && params.sessionId.trim().length > 0
        ? params.sessionId.trim()
        : null;
    if (!sessionId) return null;
    const cwd =
      typeof params.cwd === "string" && params.cwd.trim().length > 0
        ? params.cwd.trim()
        : null;
    return {
      sessionId,
      ...(cwd ? { cwd } : {}),
    };
  },
  getDisplayId(params: Record<string, unknown> | null) {
    if (!params) return null;
    return (
      typeof params.sessionId === "string" && params.sessionId.trim().length > 0
        ? params.sessionId.trim()
        : null
    );
  },
};