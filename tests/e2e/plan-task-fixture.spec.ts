import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createPlanTaskThroughUi } from "../runner-e2e/plan-task-ui.js";
import { ensureOrganization } from "./helpers/organization";

test("planning fixture creates the exact assignment through the current composer without providers", async ({ page, request }) => {
  await ensureOrganization(request);
  const suffix = randomUUID().slice(0, 8);
  const agentIds: string[] = [];
  try {
    let lead: { id: string; name: string } | undefined;
    for (const name of [`A Different Owner ${suffix}`, `Planning Fixture Lead ${suffix}`]) {
      const response = await request.post(`/api/agents`, { data: {
        name, role: "general", adapterType: "process", adapterConfig: { command: "false" },
        runtimeConfig: { heartbeat: { enabled: false } },
      } });
      expect(response.ok()).toBe(true);
      const agent = await response.json();
      agentIds.push(agent.id);
      expect((await request.post(`/api/agents/${agent.id}/pause`)).ok()).toBe(true);
      lead = agent;
    }
    const prompt = "Plan the work briefly, then carry it out. Verify a sample order and save the requested result.";
    const created = await createPlanTaskThroughUi({ page, agentName: lead!.name, prompt });
    const issue = await (await request.get(`/api/issues/${created.id}`)).json();
    expect(issue).toMatchObject({ assigneeAgentId: lead!.id, description: prompt, workMode: "standard" });
    const runs = await request.get(`/api/heartbeat-runs?limit=100`);
    expect(runs.ok()).toBe(true);
    expect((await runs.json()).filter((run: { agentId: string }) => agentIds.includes(run.agentId))).toEqual([]);
  } finally {
    for (const id of agentIds) await request.post(`/api/agents/${id}/terminate`);
  }
});
