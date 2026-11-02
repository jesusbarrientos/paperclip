import { describe, expect, it, vi } from "vitest";
import { callCreateSkillTool, createSkillToolInput, callUpdateSkillTool, updateSkillToolInput } from "./skill-tools.js";

const input = {
  name: "release-review", description: "Review release notes.", idempotencyKey: "release-review-1",
  markdown: "---\nname: release-review\ndescription: Review release notes.\n---\n\n# Review\nCheck each release note against the change.\n",
};

describe("create skill tool", () => {
  it("requires a usable skill with matching frontmatter", () => {
    expect(createSkillToolInput.parse(input)).toEqual(input);
    for (const markdown of ["I created it", "---\nname: different\ndescription: Review release notes.\n---\nBody", "---\nname: release-review\ndescription: Review release notes.\n---\n"]) {
      expect(createSkillToolInput.safeParse({ ...input, markdown }).success).toBe(false);
    }
  });

  it.each([
    { markdown: "---\nname: [broken\n---\nBody" },
    { markdown: input.markdown.replace("description: Review release notes.", "description: Different purpose.") },
    { slug: "another-skill" },
    { markdown: "No frontmatter." },
  ])("rejects invalid skill content before any API call (%j)", async (invalid) => {
    const fetcher = vi.fn();
    await expect(callCreateSkillTool({ arguments: { ...input, ...invalid },
      apiUrl: "http://localhost:3100", token: "test-token" }, fetcher)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses the authenticated skills route and returns only a portable skill reference", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "skill-1", name: input.name,
      slug: input.name, description: input.description, currentVersionId: "version-1", sourceLocator: "/private/managed/skill", markdown: input.markdown }), { status: 201 }));
    const result = await callCreateSkillTool({ arguments: input, apiUrl: "http://localhost:3100/api", token: "test-token" }, fetcher);
    expect(fetcher).toHaveBeenCalledWith("http://localhost:3100/api/skills", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual(input);
    expect(result).toEqual({ id: "skill-1", name: input.name, slug: input.name, description: input.description, versionId: "version-1", studioPath: "/skills/studio/skill-1" });
  });
});

describe("update skill tool", () => {
  const args = { skillId: "00000000-0000-4000-8000-000000000001", expectedVersionId: "00000000-0000-4000-8000-000000000002",
    markdown: input.markdown, idempotencyKey: "update-1" };

  it("rejects incomplete content without a request", async () => {
    const fetcher = vi.fn();
    expect(updateSkillToolInput.parse(args)).toEqual(args);
    for (const invalid of [{ markdown: "# Missing frontmatter" }, { markdown: input.markdown.replace("# Review\nCheck each release note against the change.", "  ") },
      { expectedVersionId: "not-a-uuid" }]) {
      await expect(callUpdateSkillTool({ arguments: { ...args, ...invalid }, apiUrl: "http://localhost", token: "token" }, fetcher)).rejects.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("calls the skill file endpoint and returns a compact receipt", async () => {
    const receipt = { skillId: args.skillId, versionId: "next-version", path: "SKILL.md", studioPath: `/skills/studio/${args.skillId}` };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...receipt, content: args.markdown }), { status: 200 }));
    expect(await callUpdateSkillTool({ arguments: args, apiUrl: "http://localhost/api", token: "token" }, fetcher)).toEqual(receipt);
    expect(fetcher).toHaveBeenCalledWith(`http://localhost/api/skills/${args.skillId}/files`, expect.objectContaining({ method: "PATCH" }));
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({ path: "SKILL.md", content: args.markdown,
      expectedVersionId: args.expectedVersionId, idempotencyKey: args.idempotencyKey });
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Skill version changed" }), { status: 409 }));
    await expect(callUpdateSkillTool({ arguments: args, apiUrl: "http://localhost", token: "token" }, fetcher)).rejects.toThrow("Skill version changed");
  });
});
