import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  chatEndpointResources,
  chatIdentityLinks,
  connectionGrants,
  toolCatalogEntries,
  toolPolicies,
  toolProfileBindings,
  toolProfileEntries,
  toolProfiles,
  type Db,
} from "@paperclipai/db";

/** Only authorization fields participate: receiving messages must not reset sessions. */
export async function slackAuthorizationRevision(
  db: Db,
  endpointId: string,
  connectionId: string,
  agentId: string,
  userId: string,
) {
  const values = await Promise.all([
    db
      .select({
        id: chatEndpointResources.id,
        available: chatEndpointResources.availability,
        enabled: chatEndpointResources.enabled,
      })
      .from(chatEndpointResources)
      .where(
        eq(chatEndpointResources.endpointId, endpointId),
      )
      .orderBy(chatEndpointResources.id),
    db
      .select({
        id: chatIdentityLinks.id,
        status: chatIdentityLinks.status,
        user: chatIdentityLinks.paperclipUserId,
        updatedAt: chatIdentityLinks.updatedAt,
      })
      .from(chatIdentityLinks)
      .where(
        and(
          eq(chatIdentityLinks.endpointId, endpointId),
          eq(chatIdentityLinks.paperclipUserId, userId),
        ),
      )
      .orderBy(chatIdentityLinks.id),
    db
      .select({
        id: connectionGrants.id,
        status: connectionGrants.status,
        updatedAt: connectionGrants.updatedAt,
      })
      .from(connectionGrants)
      .where(
        and(
          eq(connectionGrants.connectionId, connectionId),
          eq(connectionGrants.subjectUserId, userId),
        ),
      )
      .orderBy(connectionGrants.id),
    db
      .select({
        id: toolCatalogEntries.id,
        hash: toolCatalogEntries.versionHash,
        status: toolCatalogEntries.status,
        quarantine: toolCatalogEntries.quarantinedAt,
      })
      .from(toolCatalogEntries)
      .where(
        eq(toolCatalogEntries.connectionId, connectionId),
      )
      .orderBy(toolCatalogEntries.id),
    db
      .select()
      .from(toolPolicies)
      .orderBy(toolPolicies.id),
    db
      .select()
      .from(toolProfiles)
      .orderBy(toolProfiles.id),
    db
      .select()
      .from(toolProfileEntries)
      .orderBy(toolProfileEntries.id),
    db
      .select()
      .from(toolProfileBindings)
      .where(
        eq(toolProfileBindings.targetId, agentId),
      )
      .orderBy(toolProfileBindings.id),
  ]);
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}
