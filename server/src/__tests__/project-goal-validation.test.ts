import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  companies,
  createDb,
  goals,
  projectGoals,
  projects as projectsTable,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { HttpError } from "../errors.js";
import { projectService } from "../services/projects.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres project goal validation tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

// Before this validation, a nonexistent goal id died at the projects.goal_id
// foreign key as an opaque 500.
describeEmbeddedPostgres("project goal validation", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-project-goal-validation-");
    db = createDb(tempDb.connectionString);
    await db.insert(companies).values({ name: "Goal validation", issuePrefix: "GV" });
  }, 20_000);

  afterEach(async () => {
    await db.delete(projectGoals);
    await db.delete(projectsTable);
    await db.delete(goals);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedGoal(title: string): Promise<string> {
    const [goal] = await db
      .insert(goals)
      .values({ title, level: "task", status: "active" })
      .returning();
    return goal.id;
  }

  function expectUnprocessable(error: unknown, unknownGoalId: string) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(422);
    expect((error as Error).message).toContain(unknownGoalId);
  }

  it("creates and links a project to a goal", async () => {
    const goalId = await seedGoal("Ship it");
    const projects = projectService(db);

    const created = await projects.create({ name: "Rocket", goalIds: [goalId] });
    expect(created.goalIds).toEqual([goalId]);
  });

  it("rejects a create whose goal id does not exist, before any insert", async () => {
    const projects = projectService(db);
    const ghost = "db7da378-99a6-43ea-964f-000000000000";

    const failure = await projects
      .create({ name: "Rocket", goalIds: [ghost] })
      .then(() => null, (error: unknown) => error);
    expectUnprocessable(failure, ghost);

    const rows = await db.select({ id: projectsTable.id }).from(projectsTable);
    expect(rows).toHaveLength(0);
  });

  it("rejects the legacy single goalId field the same way", async () => {
    const projects = projectService(db);
    const ghost = "db7da378-99a6-43ea-964f-111111111111";

    const failure = await projects
      .create({ name: "Rocket", goalId: ghost })
      .then(() => null, (error: unknown) => error);
    expectUnprocessable(failure, ghost);
  });

  it("ignores the legacy goalId when an explicit empty goalIds list wins resolution", async () => {
    // goalIds and goalId may arrive together; the resolved set (goalIds
    // first) is canonical for persistence too.
    const otherGoalId = await seedGoal("Should not link");
    const projects = projectService(db);

    const created = await projects.create({
      name: "Rocket",
      goalIds: [],
      goalId: otherGoalId,
    });
    expect(created.goalIds).toEqual([]);

    const [row] = await db
      .select({ goalId: projectsTable.goalId })
      .from(projectsTable)
      .where(eq(projectsTable.id, created.id));
    expect(row.goalId).toBeNull();
  });

  it("rejects an update to an unknown goal and leaves links unchanged", async () => {
    const goodGoalId = await seedGoal("Good goal");
    const otherGoalId = "db7da378-99a6-43ea-964f-222222222222";
    const projects = projectService(db);

    const created = await projects.create({ name: "Rocket", goalIds: [goodGoalId] });

    const failure = await projects
      .update(created.id, { goalIds: [otherGoalId] })
      .then(() => null, (error: unknown) => error);
    expectUnprocessable(failure, otherGoalId);

    const fetched = await projects.getById(created.id);
    expect(fetched?.goalIds).toEqual([goodGoalId]);
  });
});
