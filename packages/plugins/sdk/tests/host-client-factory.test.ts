import { describe, expect, it, vi } from "vitest";

import type { HostServices } from "../src/host-client-factory.js";
import {
  CapabilityDeniedError,
  createHostClientHandlers,
} from "../src/host-client-factory.js";

describe("createHostClientHandlers", () => {
  it("passes config and secret calls through with the host call context", async () => {
    const configGet = vi.fn(async () => ({ apiKeyRef: "ref" }));
    const secretsResolve = vi.fn(async () => "resolved");
    const services = {
      config: { get: configGet },
      secrets: { resolve: secretsResolve },
    } as unknown as HostServices;

    const handlers = createHostClientHandlers({
      pluginId: "paperclip.test",
      capabilities: ["secrets.read-ref"],
      services,
    });
    const context = { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" };

    await expect(
      handlers["config.get"]({}, context),
    ).resolves.toEqual({ apiKeyRef: "ref" });
    await expect(
      handlers["secrets.resolve"]({
        secretRef: { type: "secret_ref", secretId: "secret-a" },
      }, context),
    ).resolves.toBe("resolved");

    expect(configGet).toHaveBeenCalledWith({}, context);
    expect(secretsResolve).toHaveBeenCalledWith({
      secretRef: { type: "secret_ref", secretId: "secret-a" },
    }, context);
  });

  it.each([
    [
      "access.members.list",
      "access.members.read",
      {},
      (services: HostServices) => vi.mocked(services.access.listMembers),
    ],
    [
      "access.members.update",
      "access.members.write",
      { memberId: "member-a", patch: { status: "active" } },
      (services: HostServices) => vi.mocked(services.access.updateMember),
    ],
    [
      "authorization.grants.set",
      "authorization.grants.write",
      { principalType: "agent", principalId: "agent-a", grants: [] },
      (services: HostServices) => vi.mocked(services.authorization.setGrants),
    ],
    [
      "authorization.policies.update",
      "authorization.policies.write",
      { resourceType: "agent", resourceId: "agent-a", policy: null },
      (services: HostServices) => vi.mocked(services.authorization.updatePolicy),
    ],
    [
      "authorization.audit.search",
      "authorization.audit.read",
      {},
      (services: HostServices) => vi.mocked(services.authorization.searchAudit),
    ],
  ] as const)(
    "rejects %s when the plugin lacks %s",
    async (method, capability, params, getDelegate) => {
      const services = {
        access: {
          listMembers: vi.fn(async () => []),
          updateMember: vi.fn(async () => ({ id: "member-a" })),
        },
        authorization: {
          setGrants: vi.fn(async () => []),
          updatePolicy: vi.fn(async () => ({ policy: null })),
          searchAudit: vi.fn(async () => []),
        },
      } as unknown as HostServices;
      const handlers = createHostClientHandlers({
        pluginId: "paperclip.test",
        capabilities: [],
        services,
      });

      await expect(
        (handlers as Record<string, (input: unknown) => Promise<unknown>>)[method](params),
      ).rejects.toMatchObject({
        name: "CapabilityDeniedError",
        message: expect.stringContaining(capability),
      });
      await expect(
        (handlers as Record<string, (input: unknown) => Promise<unknown>>)[method](params),
      ).rejects.toBeInstanceOf(CapabilityDeniedError);
      expect(getDelegate(services)).not.toHaveBeenCalled();
    },
  );

  it("rejects a human-attributed createComment call when only issue.comments.create is granted", async () => {
    const createComment = vi.fn(async () => ({ id: "comment-1" }));
    const services = {
      issues: { createComment },
    } as unknown as HostServices;
    const handlers = createHostClientHandlers({
      pluginId: "paperclip.test",
      capabilities: ["issue.comments.create"],
      services,
    });
    const context = { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" };

    await expect(
      handlers["issues.createComment"]({
        issueId: "issue-a",
        body: "hello",
        actorUserId: "user-a",
      }, context),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);
    expect(createComment).not.toHaveBeenCalled();
  });

  it("allows a human-attributed createComment call once issue.comments.create_human_attributed is also granted", async () => {
    const createComment = vi.fn(async () => ({ id: "comment-1" }));
    const services = {
      issues: { createComment },
    } as unknown as HostServices;
    const handlers = createHostClientHandlers({
      pluginId: "paperclip.test",
      capabilities: ["issue.comments.create", "issue.comments.create_human_attributed"],
      services,
    });
    const context = { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" };

    await expect(
      handlers["issues.createComment"]({
        issueId: "issue-a",
        body: "hello",
        actorUserId: "user-a",
      }, context),
    ).resolves.toEqual({ id: "comment-1" });
    expect(createComment).toHaveBeenCalledWith({
      issueId: "issue-a",
      body: "hello",
      actorUserId: "user-a",
    });
  });

  it("still allows a plain agent-attributed createComment call without the human-attribution capability", async () => {
    const createComment = vi.fn(async () => ({ id: "comment-2" }));
    const services = {
      issues: { createComment },
    } as unknown as HostServices;
    const handlers = createHostClientHandlers({
      pluginId: "paperclip.test",
      capabilities: ["issue.comments.create"],
      services,
    });
    const context = { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" };

    await expect(
      handlers["issues.createComment"]({
        issueId: "issue-a",
        body: "hello",
        authorAgentId: "agent-a",
      }, context),
    ).resolves.toEqual({ id: "comment-2" });
    expect(createComment).toHaveBeenCalled();
  });
});

describe("createHostClientHandlers capability gating for LOOA-641 methods", () => {
  const context = { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" };

  it("denies issues.respondInteraction without issue.interactions.respond", async () => {
    const respondInteraction = vi.fn(async () => ({ interaction: { id: "i" }, applied: true }));
    const services = { issues: { respondInteraction } } as unknown as HostServices;
    const handlers = createHostClientHandlers({
      pluginId: "paperclip.test",
      // A read grant must not confer the ability to respond.
      capabilities: ["issue.interactions.read"],
      services,
    });
    await expect(
      handlers["issues.respondInteraction"]({
        issueId: "issue-a", interactionId: "int-a", action: "accept", actorUserId: "user-a",
      }, context),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);
    expect(respondInteraction).not.toHaveBeenCalled();
  });

  it("allows issues.respondInteraction with issue.interactions.respond", async () => {
    const respondInteraction = vi.fn(async () => ({ interaction: { id: "i" }, applied: true }));
    const services = { issues: { respondInteraction } } as unknown as HostServices;
    const handlers = createHostClientHandlers({
      pluginId: "paperclip.test",
      capabilities: ["issue.interactions.respond"],
      services,
    });
    await expect(
      handlers["issues.respondInteraction"]({
        issueId: "issue-a", interactionId: "int-a", action: "accept", actorUserId: "user-a",
      }, context),
    ).resolves.toEqual({ interaction: { id: "i" }, applied: true });
    expect(respondInteraction).toHaveBeenCalledOnce();
  });

  it("denies approvals.decide without approvals.respond", async () => {
    const decide = vi.fn(async () => ({ approval: { id: "a" }, applied: true }));
    const services = { approvals: { decide } } as unknown as HostServices;
    const handlers = createHostClientHandlers({
      pluginId: "paperclip.test",
      // A read grant must not confer the ability to decide.
      capabilities: ["approvals.read"],
      services,
    });
    await expect(
      handlers["approvals.decide"]({
        approvalId: "a", action: "approve", actorUserId: "user-a",
      }, context),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);
    expect(decide).not.toHaveBeenCalled();
  });

  it("allows approvals.decide with approvals.respond", async () => {
    const decide = vi.fn(async () => ({ approval: { id: "a" }, applied: true }));
    const services = { approvals: { decide } } as unknown as HostServices;
    const handlers = createHostClientHandlers({
      pluginId: "paperclip.test",
      capabilities: ["approvals.respond"],
      services,
    });
    await expect(
      handlers["approvals.decide"]({
        approvalId: "a", action: "approve", actorUserId: "user-a",
      }, context),
    ).resolves.toEqual({ approval: { id: "a" }, applied: true });
    expect(decide).toHaveBeenCalledOnce();
  });

  it("denies read methods without their read capability", async () => {
    const listInteractions = vi.fn(async () => []);
    const list = vi.fn(async () => []);
    const getAttachmentContent = vi.fn(async () => null);
    const services = {
      issues: { listInteractions, getAttachmentContent },
      approvals: { list },
    } as unknown as HostServices;
    const handlers = createHostClientHandlers({
      pluginId: "paperclip.test",
      capabilities: [],
      services,
    });
    await expect(
      handlers["issues.listInteractions"]({ issueId: "i" }, context),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);
    await expect(
      handlers["approvals.list"]({}, context),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);
    await expect(
      handlers["issues.getAttachmentContent"]({ attachmentId: "at" }, context),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);
    expect(listInteractions).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    expect(getAttachmentContent).not.toHaveBeenCalled();
  });
});
