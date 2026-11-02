import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createDb,
  pluginEntities,
  pluginJobs,
  pluginJobRuns,
  pluginLogs,
  pluginWebhookDeliveries,
  plugins,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping plugin entity uniqueness tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("plugin entity uniqueness", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-plugin-tenant-isolation-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(pluginEntities);
    await db.delete(pluginJobRuns);
    await db.delete(pluginJobs);
    await db.delete(pluginLogs);
    await db.delete(pluginWebhookDeliveries);
    await db.delete(plugins);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedPlugin() {
    const pluginId = randomUUID();
    await db.insert(plugins).values({
      id: pluginId,
      pluginKey: "paperclip.tenant-isolation-test",
      packageName: "@paperclipai/plugin-tenant-isolation-test",
      version: "0.0.1",
      apiVersion: 1,
      categories: ["automation"],
      manifestJson: {
        id: "paperclip.tenant-isolation-test",
        apiVersion: 1,
        version: "0.0.1",
        displayName: "Tenant Isolation Test",
        description: "Test plugin",
        author: "Paperclip",
        categories: ["automation"],
        capabilities: [],
        entrypoints: { worker: "./dist/worker.js" },
      },
      status: "ready",
      installOrder: 1,
    });
    return pluginId;
  }

  it("plugin_entities unique index rejects a duplicate (pluginId, entityType, externalId)", async () => {
    const pluginId = await seedPlugin();

    await db.insert(pluginEntities).values({
      pluginId,
      entityType: "cron",
      scopeKind: "instance",
      scopeId: null,
      externalId: "global-cron-1",
    });

    const err = await db
      .insert(pluginEntities)
      .values({
        pluginId,
        entityType: "cron",
        scopeKind: "instance",
        scopeId: null,
        externalId: "global-cron-1",
      })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(err).toBeInstanceOf(Error);
    expect((err as { cause?: { code?: string } }).cause?.code).toBe("23505");
  });
});
