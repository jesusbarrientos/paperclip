import { mkdir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { hasUsableGrokAuthValue, parseGrokAuthPayload, resolveManagedGrokHomeDir } from "../../packages/adapters/grok-local/src/server/grok-home.js";

function credential(raw: string) {
  if (Buffer.byteLength(raw) > 256 * 1024) throw new Error("Grok fixture credential exceeds its bound");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Grok fixture credential is malformed"); }
  const result = parseGrokAuthPayload(parsed);
  if (!result || !hasUsableGrokAuthValue(result.value)) throw new Error("Grok fixture credential is malformed");
  return result;
}

/** Test setup only: seed the explicit login in the disposable instance's Grok home.
 * Production credential discovery, process fencing, and refresh remain unchanged.
 */
export async function stageGrokSubscriptionFixture(input: {
  raw: string;
  environment: NodeJS.ProcessEnv;
}): Promise<() => Promise<void>> {
  credential(input.raw);
  const env = input.environment;
  const root = env.PAPERCLIP_RUNNER_E2E_TEMP_ROOT;
  if (!root || !/^runner-e2e-[a-z0-9-]+$/.test(env.PAPERCLIP_INSTANCE_ID ?? "")) {
    throw new Error("Grok fixture requires an isolated test instance");
  }
  const canonicalRoot = await realpath(root);
  const home = env.PAPERCLIP_HOME;
  if (!home || await realpath(home) !== path.join(canonicalRoot, "paperclip-home")) {
    throw new Error("Grok fixture refuses a home outside its isolated test root");
  }
  const grokHome = resolveManagedGrokHomeDir(env);
  await mkdir(grokHome, { recursive: true, mode: 0o700 });
  if (!(await realpath(grokHome)).startsWith(`${canonicalRoot}${path.sep}`)) {
    throw new Error("Grok fixture refuses a redirected Grok home");
  }
  // Never replace an existing login, including through a symlink.
  await writeFile(path.join(grokHome, "auth.json"), input.raw, { flag: "wx", mode: 0o600 });
  return () => rm(grokHome, { recursive: true, force: true });
}
