/** Server-owned rollout policy. Never read from agent tool arguments. */
export function runnerApiToolsEnabled(
  bindingOverride?: boolean,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  const enabled = environment.PAPERCLIP_RUNNER_API_TOOLS_ENABLED;
  // Enabled by default. Explicit settings fail closed; bindings can only narrow access.
  return !((enabled !== undefined && enabled !== "true") || bindingOverride === false);
}
