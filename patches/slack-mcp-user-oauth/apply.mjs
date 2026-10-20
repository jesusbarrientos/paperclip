// Fix for paperclipai/paperclip#13935 (same change as the open upstream PR #14037).
//
// Slack's hosted MCP server (mcp.slack.com) only accepts USER tokens. Its
// authorization-server metadata (https://mcp.slack.com/.well-known/oauth-authorization-server)
// advertises:
//   authorization_endpoint: https://slack.com/oauth/v2_user/authorize
//   token_endpoint:         https://slack.com/api/oauth.v2.user.access
// Paperclip's gallery definition pins the classic BOT endpoints instead
// (oauth/v2/authorize + oauth.v2.access), so the `scope=` list is read as bot
// scopes and Slack rejects consent with "Invalid permissions requested"
// (channels:write, search:read.*, … only exist as user scopes). Because both
// endpoints are pinned, Paperclip never falls back to discovery to correct them.
//
// Patches every copy shipped in the image:
//   packages/shared/src/app-definitions/slack.json   (what the server loads via tsx)
//   packages/shared/dist/app-definitions/slack.json  (published build)
//   ui/dist/assets/*.js                              (the UI's inlined copy; display only)
//
// Usage: node apply-slack-mcp-user-oauth.mjs [/app]
// Idempotent. Exits non-zero if the server definition doesn't look like what we
// patch, so a broken base image fails the build instead of shipping silently.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? "/app";

const BOT_AUTHORIZE = "https://slack.com/oauth/v2/authorize";
const BOT_TOKEN = "https://slack.com/api/oauth.v2.access";
const USER_AUTHORIZE = "https://slack.com/oauth/v2_user/authorize";
const USER_TOKEN = "https://slack.com/api/oauth.v2.user.access";
const OLD_GUIDANCE = "Connect a Slack workspace and limit access to the channels agents need.";
const NEW_GUIDANCE =
  OLD_GUIDANCE +
  " In your Slack app, add the scopes named below under User Token Scopes (not Bot Token Scopes)," +
  " add Paperclip's callback URL as a Redirect URL, and turn on Model Context Protocol under Features > Agents & AI Apps.";

function patchJson(file, required) {
  if (!existsSync(file)) {
    if (required) throw new Error(`missing ${file}`);
    console.log(`[slack-fix] skip (absent): ${file}`);
    return;
  }
  const app = JSON.parse(readFileSync(file, "utf8"));
  const method = app.methods?.find(
    (m) => m.key === "mcp-oauth" && m.defaults?.serverUrl === "https://mcp.slack.com/mcp",
  );
  if (!method) throw new Error(`mcp-oauth method for mcp.slack.com not found in ${file}`);
  const d = method.defaults;
  if (d.authorizationEndpoint === USER_AUTHORIZE && d.tokenEndpoint === USER_TOKEN) {
    console.log(`[slack-fix] already patched: ${file}`);
    return;
  }
  if (d.authorizationEndpoint !== BOT_AUTHORIZE || d.tokenEndpoint !== BOT_TOKEN)
    throw new Error(`unexpected endpoints in ${file}: ${d.authorizationEndpoint} / ${d.tokenEndpoint}`);
  d.authorizationEndpoint = USER_AUTHORIZE;
  d.tokenEndpoint = USER_TOKEN;
  if (method.guidanceMd === OLD_GUIDANCE) method.guidanceMd = NEW_GUIDANCE;
  writeFileSync(file, JSON.stringify(app, null, 2) + "\n");
  console.log(`[slack-fix] patched: ${file}`);
}

function patchUiBundle(dir) {
  if (!existsSync(dir)) return console.log(`[slack-fix] skip (absent): ${dir}`);
  // Minified form: serverUrl:"https://mcp.slack.com/mcp",authorizationEndpoint:"…",tokenEndpoint:"…"
  const pattern =
    /(serverUrl:"https:\/\/mcp\.slack\.com\/mcp",authorizationEndpoint:")https:\/\/slack\.com\/oauth\/v2\/authorize(",tokenEndpoint:")https:\/\/slack\.com\/api\/oauth\.v2\.access(")/g;
  let hits = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".js")) continue;
    const file = join(dir, name);
    const src = readFileSync(file, "utf8");
    if (!src.includes("mcp.slack.com/mcp")) continue;
    let out = src.replace(pattern, `$1${USER_AUTHORIZE}$2${USER_TOKEN}$3`);
    if (out !== src) out = out.split(JSON.stringify(OLD_GUIDANCE)).join(JSON.stringify(NEW_GUIDANCE));
    if (out !== src) {
      writeFileSync(file, out);
      hits++;
      console.log(`[slack-fix] patched UI bundle: ${file}`);
    }
  }
  if (hits === 0) console.log("[slack-fix] UI bundle: nothing to patch (display-only, not fatal)");
}

try {
  patchJson(join(root, "packages/shared/src/app-definitions/slack.json"), true);
  patchJson(join(root, "packages/shared/dist/app-definitions/slack.json"), false);
  patchUiBundle(join(root, "ui/dist/assets"));
} catch (error) {
  console.error(`[slack-fix] ${error.message}`);
  process.exit(1);
}
