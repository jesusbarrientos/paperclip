// Build-time check: load the definition exactly the way the server does
// (@paperclipai/shared through tsx) and assert the Slack MCP method now uses
// Slack's user-token OAuth endpoints.
import { getConnectableAppDefinition } from "@paperclipai/shared";

const slack = getConnectableAppDefinition("slack");
const method = slack?.methods.find((m) => m.key === "mcp-oauth");
const d = method?.defaults;
const ok =
  d?.authorizationEndpoint === "https://slack.com/oauth/v2_user/authorize" &&
  d?.tokenEndpoint === "https://slack.com/api/oauth.v2.user.access";
console.log("[slack-fix] server sees:", d?.authorizationEndpoint, d?.tokenEndpoint);
if (!ok) {
  console.error("[slack-fix] verification FAILED");
  process.exit(1);
}
console.log("[slack-fix] verification OK");
