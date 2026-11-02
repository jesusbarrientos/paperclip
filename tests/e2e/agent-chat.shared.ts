import path from "node:path";
import { createLocalAgentJwt } from "../../server/src/agent-auth-jwt";
import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { ensureOrganization } from "./helpers/organization";

// Per-file Playwright configuration (test.use, test.setTimeout) must stay in
// the spec files themselves: calling test.use() from a shared helper makes
// Playwright fail the whole worker with "inconsistent test.use() options".
export async function json(response: Awaited<ReturnType<APIRequestContext["get"]>>) {
  expect(response.ok(), `${response.status()} ${await response.text()}`).toBe(
    true,
  );
  return response.json();
}
export async function setup(request: APIRequestContext) {
  await ensureOrganization(request);
  const startedAt = Date.now();
  // The organization is shared with every other spec, so agent names carry a
  // per-setup tag and reads below are scoped to what this setup created.
  const tag = startedAt.toString(36);
  const original = await json(
    await request.get("/api/instance/settings/experimental"),
  );
  await json(
    await request.patch("/api/instance/settings/experimental", {
      data: { enableAgentChat: true, enableClassicTaskInterface: false },
    }),
  );
  const agents = [];
  for (const name of ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"])
    agents.push(
      await json(
        await request.post("/api/agents", {
          data: {
            name: `${name} ${tag}`,
            adapterType: "process",
            adapterConfig: {
              command: process.execPath,
              args: [path.resolve("tests/e2e/fixtures/agent-chat.mjs")],
              graceSec: 1,
            },
            runtimeConfig: {
              heartbeat: { enabled: false, wakeOnDemand: true },
            },
          },
        }),
      ),
    );
  const agent = agents[0];
  const agentIds = new Set<string>(agents.map((row: any) => row.id));
  const chatPath = `/api/chats/${agent.id}`;
  const route = `/chats/${agent.id}`;
  const createdSinceSetup = (row: any) => Date.parse(row.createdAt) >= startedAt;
  const tasks = async (): Promise<any[]> =>
    (await json(await request.get("/api/issues"))).filter(createdSinceSetup);
  const projects = async (): Promise<any[]> =>
    (await json(await request.get("/api/projects"))).filter(createdSinceSetup);
  const runs = async (): Promise<any[]> =>
    (await json(await request.get("/api/heartbeat-runs"))).filter((run: any) =>
      agentIds.has(run.agentId),
    );
  return {
    tag,
    agents,
    agent,
    chatPath,
    route,
    tasks,
    projects,
    runs,
    restore: async () => {
      try {
        const chat = await request.get(chatPath);
        const history = chat.ok() ? await chat.json() : null;
        const taskRows = await tasks();
        const projectRows = await projects();
        const ledger = await runs();
        const documents = await Promise.all(
          [...(history ? [history] : []), ...taskRows].map(async (task: any) => ({
            taskId: task.id,
            documents: await json(
              await request.get(`/api/issues/${task.id}/documents`),
            ),
          })),
        );
        await test.info().attach("chat-persisted-state", {
          contentType: "application/json",
          body: Buffer.from(
            JSON.stringify(
              {
                chat: history,
                tasks: taskRows,
                projects: projectRows,
                documents,
                comments: history
                  ? await json(
                      await request.get(`/api/issues/${history.id}/comments`),
                    )
                  : [],
                runs: ledger.map((run: any) => ({
                  id: run.id,
                  status: run.status,
                  startedAt: run.startedAt,
                  finishedAt: run.finishedAt,
                  sessionIdBefore: run.sessionIdBefore,
                  sessionIdAfter: run.sessionIdAfter,
                  issueId: run.contextSnapshot?.issueId,
                  generation:
                    run.contextSnapshot?.conversationSessionGeneration,
                  reset: run.contextSnapshot?.conversationReset,
                })),
              },
              null,
              2,
            ),
          ),
        });
      } finally {
        const liveRuns = (await json(await request.get("/api/live-runs"))).filter(
          (run: any) => agentIds.has(run.agentId),
        );
        for (const run of liveRuns)
          await json(
            await request.post(`/api/heartbeat-runs/${run.id}/cancel`),
          );
        await json(
          await request.patch("/api/instance/settings/experimental", {
            data: {
              enableAgentChat: original.enableAgentChat,
              enableClassicTaskInterface: original.enableClassicTaskInterface,
            },
          }),
        );
      }
    },
  };
}
export async function send(page: Page, value: unknown) {
  await page
    .getByTestId("task-chat-composer-input")
    .last()
    .locator('[contenteditable="true"],textarea')
    .first()
    .fill(
      typeof value === "string"
        ? value
        : `fixture:${Buffer.from(JSON.stringify(value)).toString("base64url")}`,
    );
  await page.getByTestId("task-chat-composer-send").last().click();
}
export async function idle(
  request: APIRequestContext,
  chatPath: string,
  minimumReplies = 1,
) {
  let issue: any;
  await expect
    .poll(
      async () => {
        issue = await json(await request.get(chatPath));
        if (!issue) return false;
        const replies = await json(
          await request.get(`/api/issues/${issue.id}/comments`),
        );
        const live = await json(
          await request.get(`/api/issues/${issue.id}/live-runs`),
        );
        return (
          live.length === 0 &&
          issue.conversationState === "waiting" &&
          issue.status === "in_review" &&
          replies.filter((c: any) => c.authorAgentId).length >= minimumReplies
        );
      },
      { timeout: 60_000, intervals: [100, 250, 500] },
    )
    .toBe(true);
  return issue;
}
