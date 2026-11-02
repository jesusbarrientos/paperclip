import { and, eq } from "drizzle-orm";
import { chatEndpoints, toolConnections, type Db } from "@paperclipai/db";
import {
  SLACK_TOOLS,
  SLACK_BOT_TOOL_SCOPES,
  type SlackToolCapabilities,
} from "@paperclipai/shared";
import { notFound } from "../../errors.js";
import { secretService } from "../secrets.js";
import { slackClient } from "./slack-client.js";
export async function slackCapabilities(
  db: Db,
  endpointId: string,
): Promise<SlackToolCapabilities> {
  const [row] = await db
    .select({ endpoint: chatEndpoints, connection: toolConnections })
    .from(chatEndpoints)
    .innerJoin(
      toolConnections,
      eq(toolConnections.id, chatEndpoints.connectionId),
    )
    .where(
      and(
        eq(chatEndpoints.id, endpointId),
        eq(chatEndpoints.provider, "slack"),
      ),
    );
  if (
    !row ||
    !row.connection.enabled ||
    !["active", "verifying"].includes(row.endpoint.status)
  )
    throw notFound("Active Slack connection not found");
  const ref = row.connection.credentialSecretRefs.find(
    (r) => r.configPath === "credentials.botToken",
  );
  if (!ref) throw notFound("Slack bot credential is unavailable");
  const token = await secretService(db).resolveSecretValue(
    ref.secretId,
    ref.versionSelector ?? "latest",
    {
      consumerType: "tool_connection",
      consumerId: row.connection.id,
      configPath: ref.configPath,
      actorType: "system",
      actorId: null,
    },
  );
  const auth = await slackClient(token)("auth.test");
  const scopes = Array.isArray(auth.grantedScopes)
    ? auth.grantedScopes.filter((s): s is string => typeof s === "string")
    : null;
  return {
    grantedScopes: scopes,
    missingScopes: scopes
      ? [
          ...new Set([
            ...SLACK_BOT_TOOL_SCOPES,
            ...SLACK_TOOLS.filter(
              (tool) => tool.name !== "slack_search",
            ).flatMap((tool) =>
              tool.scopes.flatMap((scope) => scope.split("|")),
            ),
          ]),
        ].filter((s) => !scopes.includes(s))
      : [],
    tools: SLACK_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      risk: t.risk,
      available:
        t.name === "slack_search"
          ? true
          : scopes
            ? t.scopes.every((s) =>
                s.split("|").some((scope) => scopes.includes(scope)),
              )
            : null,
    })),
  };
}
