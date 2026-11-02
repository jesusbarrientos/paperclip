import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  activityLog,
  organizations,
  companyMemberships,
  companySecretBindings,
  companySecretVersions,
  companySecrets,
  createDb,
  secretAccessEvents,
  userSecretDeclarations,
  userSecretDefinitions,
} from "@paperclipai/db";
import { getEmbeddedPostgresTestSupport, startEmbeddedPostgresTestDatabase } from "./helpers/embedded-postgres.js";
import { secretService } from "../services/secrets.js";
import { membershipUpsert } from "./helpers/reset-organization.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping owner-scoped secrets service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("secretService resolveAdapterConfigForRuntime — userSecretMediation", () => {
  let stopDb: (() => Promise<void>) | null = null;
  let db!: ReturnType<typeof createDb>;
  const previousKeyFile = process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE;
  const secretsTmpDir = path.join(os.tmpdir(), `paperclip-owner-scoped-${randomUUID()}`);

  beforeAll(async () => {
    mkdirSync(secretsTmpDir, { recursive: true });
    process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE = path.join(secretsTmpDir, "master.key");
    const started = await startEmbeddedPostgresTestDatabase("owner-scoped-secrets");
    stopDb = started.cleanup;
    db = createDb(started.connectionString);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.delete(activityLog);
    await db.delete(secretAccessEvents);
    await db.delete(userSecretDeclarations);
    await db.delete(companySecretBindings);
    await db.delete(companySecretVersions);
    await db.delete(companySecrets);
    await db.delete(userSecretDefinitions);
    await db.delete(companyMemberships);
    await db.delete(organizations);
  });

  afterAll(async () => {
    if (stopDb) await stopDb();
    if (previousKeyFile === undefined) {
      delete process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE;
    } else {
      process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE = previousKeyFile;
    }
    rmSync(secretsTmpDir, { recursive: true, force: true });
  });

  async function seedOrganization() {
    await db.insert(organizations).values({
      name: "Acme",
      issuePrefix: "ACME",
      status: "active",
    });
  }

  async function seedMember(
    userId: string,
    membershipRole: "owner" | "member" | "viewer" = "owner",
  ) {
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: userId,
      status: "active",
      membershipRole,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoUpdate(membershipUpsert);
  }

  // The honest audit consumer test-environment uses when no environment is selected.
  const ownerScopedConsumer = {
    consumerType: "system" as const,
    consumerId: "adapter_test",
    actorType: "user" as const,
    actorId: "user-1",
    actorSource: "session" as const,
  };

  it("owner_scoped resolves a required user_secret_ref by owner without a declaration row", async () => {
    await seedOrganization();
    await seedMember("user-1", "owner");
    const svc = secretService(db);
    const definition = await svc.createUserSecretDefinition({
      key: "github_token",
      name: "GitHub token",
      provider: "local_encrypted",
    });
    await svc.createCurrentUserSecretValue("user-1", {
      definitionId: definition.id,
      value: "ghp_owner_value",
    });

    const adapterConfig = {
      env: {
        GH_TOKEN: {
          type: "user_secret_ref" as const,
          key: "github_token",
          version: "latest" as const,
          required: true,
        },
      },
    };

    // No userSecretDeclarations row exists — owner_scoped must still resolve.
    const resolved = await svc.resolveAdapterConfigForRuntime(
      adapterConfig,
      { ...ownerScopedConsumer, responsibleUserId: "user-1" },
      { adapterType: "hermes_gateway", userSecretMediation: "owner_scoped" },
    );

    expect(resolved.config.env).toEqual({ GH_TOKEN: "ghp_owner_value" });
    expect(resolved.secretKeys).toEqual(new Set(["GH_TOKEN"]));
  });

  it("owner_scoped still throws responsible_user_missing when no responsible user", async () => {
    await seedOrganization();
    await seedMember("user-1", "owner");
    const svc = secretService(db);
    await svc.createUserSecretDefinition({
      key: "github_token",
      name: "GitHub token",
      provider: "local_encrypted",
    });

    const adapterConfig = {
      env: {
        GH_TOKEN: {
          type: "user_secret_ref" as const,
          key: "github_token",
          version: "latest" as const,
          required: true,
        },
      },
    };

    await expect(
      svc.resolveAdapterConfigForRuntime(
        adapterConfig,
        { ...ownerScopedConsumer, actorId: null, responsibleUserId: null },
        { adapterType: "hermes_gateway", userSecretMediation: "owner_scoped" },
      ),
    ).rejects.toMatchObject({
      status: 422,
      details: { code: "responsible_user_missing" },
    });
  });

  it("owner_scoped resolves a company secret_ref with no binding row (no regression)", async () => {
    await seedOrganization();
    await seedMember("user-1", "owner");
    const svc = secretService(db);
    const companySecret = await svc.create({
      name: `company-token-${randomUUID()}`,
      provider: "local_encrypted",
      value: "company-secret-value",
    });

    const adapterConfig = {
      env: {
        COMPANY_TOKEN: {
          type: "secret_ref" as const,
          secretId: companySecret.id,
          version: "latest" as const,
        },
      },
    };

    // No companySecretBindings row exists for this prospective config.
    const resolved = await svc.resolveAdapterConfigForRuntime(
      adapterConfig,
      { ...ownerScopedConsumer, responsibleUserId: "user-1" },
      { adapterType: "hermes_gateway", userSecretMediation: "owner_scoped" },
    );

    expect(resolved.config.env).toEqual({ COMPANY_TOKEN: "company-secret-value" });
    expect(resolved.secretKeys).toEqual(new Set(["COMPANY_TOKEN"]));
  });

  it("owner_scoped with allowedBindingIds present throws the explicit owner-scoped configuration error (fail-closed, not silently stripped)", async () => {
    await seedOrganization();
    await seedMember("user-1", "owner");
    const svc = secretService(db);
    const definition = await svc.createUserSecretDefinition({
      key: "github_token",
      name: "GitHub token",
      provider: "local_encrypted",
    });
    await svc.createCurrentUserSecretValue("user-1", {
      definitionId: definition.id,
      value: "ghp_owner_value",
    });

    const adapterConfig = {
      env: {
        GH_TOKEN: {
          type: "user_secret_ref" as const,
          key: "github_token",
          version: "latest" as const,
          required: true,
        },
      },
    };

    await expect(
      svc.resolveAdapterConfigForRuntime(
        adapterConfig,
        { ...ownerScopedConsumer, responsibleUserId: "user-1", allowedBindingIds: ["some-binding-id"] },
        { adapterType: "hermes_gateway", userSecretMediation: "owner_scoped" },
      ),
    ).rejects.toMatchObject({
      status: 422,
      details: { code: "owner_scoped_allowed_bindings_unsupported" },
    });
  });

  it("owner_scoped with an empty allowedBindingIds array is rejected too (an empty allowlist requests 'allow nothing', which owner_scoped cannot honor)", async () => {
    await seedOrganization();
    await seedMember("user-1", "owner");
    const svc = secretService(db);
    const definition = await svc.createUserSecretDefinition({
      key: "github_token",
      name: "GitHub token",
      provider: "local_encrypted",
    });
    await svc.createCurrentUserSecretValue("user-1", {
      definitionId: definition.id,
      value: "ghp_owner_value",
    });

    const adapterConfig = {
      env: {
        GH_TOKEN: {
          type: "user_secret_ref" as const,
          key: "github_token",
          version: "latest" as const,
          required: true,
        },
      },
    };

    await expect(
      svc.resolveAdapterConfigForRuntime(
        adapterConfig,
        { ...ownerScopedConsumer, responsibleUserId: "user-1", allowedBindingIds: [] },
        { adapterType: "hermes_gateway", userSecretMediation: "owner_scoped" },
      ),
    ).rejects.toMatchObject({
      status: 422,
      details: { code: "owner_scoped_allowed_bindings_unsupported" },
    });
  });

  it("declared mode is unchanged (declared ref resolves; undeclared required ref → binding_missing)", async () => {
    await seedOrganization();
    await seedMember("user-1", "owner");
    const svc = secretService(db);
    const definition = await svc.createUserSecretDefinition({
      key: "github_token",
      name: "GitHub token",
      provider: "local_encrypted",
    });
    await svc.createCurrentUserSecretValue("user-1", {
      definitionId: definition.id,
      value: "ghp_owner_value",
    });

    const declaredConsumer = {
      consumerType: "agent" as const,
      consumerId: "agent-1",
      actorType: "user" as const,
      actorId: "user-1",
      actorSource: "session" as const,
      responsibleUserId: "user-1",
    };

    const adapterConfig = {
      env: {
        GH_TOKEN: {
          type: "user_secret_ref" as const,
          key: "github_token",
          version: "latest" as const,
          required: true,
        },
      },
    };

    // Undeclared required ref → binding_missing (declaration guard active in declared mode).
    await expect(
      svc.resolveAdapterConfigForRuntime(
        adapterConfig,
        declaredConsumer,
        { adapterType: "hermes_gateway" },
      ),
    ).rejects.toMatchObject({
      status: 422,
      details: { code: "binding_missing" },
    });

    // Add the matching declaration row (configPath the resolver injects: env.<KEY>).
    await db.insert(userSecretDeclarations).values({
      userSecretDefinitionId: definition.id,
      targetType: "agent",
      targetId: "agent-1",
      configPath: "env.GH_TOKEN",
      envKey: "GH_TOKEN",
      versionSelector: "latest",
      required: true,
      allowMissingOverride: false,
    });

    const resolved = await svc.resolveAdapterConfigForRuntime(
      adapterConfig,
      declaredConsumer,
      { adapterType: "hermes_gateway" },
    );
    expect(resolved.config.env).toEqual({ GH_TOKEN: "ghp_owner_value" });
  });
});
