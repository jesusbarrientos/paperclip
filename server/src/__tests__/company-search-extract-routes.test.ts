import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type {
  CompanySearchExtractQuery,
  CompanySearchExtractResponse,
  CompanySearchQuery,
  CompanySearchResponse,
} from "@paperclipai/shared";
import { issueRoutes } from "../routes/issues.js";
import { createCompanySearchRateLimiter } from "../services/company-search-rate-limit.js";

function extractResponse(query: CompanySearchExtractQuery): CompanySearchExtractResponse {
  return {
    contains: query.contains,
    kind: query.kind,
    scope: query.scope,
    limit: query.limit,
    offset: query.offset,
    matchesPerIssue: query.matchesPerIssue,
    results: [],
    hasMore: false,
    truncated: false,
  };
}

function unusedSearch(_query: CompanySearchQuery): Promise<CompanySearchResponse> {
  throw new Error("interactive search should not be called");
}

function createApp(
  extract: (query: CompanySearchExtractQuery) => Promise<CompanySearchExtractResponse>,
  memberships: Express.Request["actor"]["memberships"] = [{ membershipRole: "operator", status: "active" }],
) {
  const app = express();
  app.use((req, _res, next) => {
    req.actor = {
      type: "board",
      userId: "user-1",
      memberships,
      source: "session",
      isInstanceAdmin: true,
    };
    next();
  });
  app.use("/api", issueRoutes({} as never, {} as never, {
    searchService: { search: unusedSearch, extract },
    searchRateLimiter: createCompanySearchRateLimiter({
      maxRequests: 1,
      windowMs: 60_000,
      now: () => 1_000,
    }),
  }));
  return app;
}

describe("company extract-search route", () => {
  it("parses the extraction query and invokes the service", async () => {
    const extract = vi.fn(async (query: CompanySearchExtractQuery) => extractResponse(query));
    const app = createApp(extract);

    const response = await request(app)
      .get("/api/search/extract")
      .query({
        contains: "github.com/example/repo/pull",
        kind: "url",
        scope: "comments",
        limit: "200",
        matchesPerIssue: "200",
      })
      .expect(200);

    expect(extract).toHaveBeenCalledWith(expect.objectContaining({
      contains: "github.com/example/repo/pull",
      kind: "url",
      scope: "comments",
      limit: 200,
      matchesPerIssue: 200,
    }));
    expect(response.body).toMatchObject({ kind: "url", scope: "comments", truncated: false });
  });

  it("denies non-members before invoking the service", async () => {
    const extract = vi.fn(async (query: CompanySearchExtractQuery) => extractResponse(query));
    const app = createApp(extract, []);

    await request(app)
      .get("/api/search/extract?contains=needle")
      .expect(403);

    expect(extract).not.toHaveBeenCalled();
  });

  it("shares the company-search rate limiter", async () => {
    const extract = vi.fn(async (query: CompanySearchExtractQuery) => extractResponse(query));
    const app = createApp(extract);

    await request(app).get("/api/search/extract?contains=needle").expect(200);
    const limited = await request(app)
      .get("/api/search/extract?contains=needle")
      .expect(429);

    expect(extract).toHaveBeenCalledTimes(1);
    expect(limited.body).toEqual({ error: "Search rate limit exceeded", retryAfterSeconds: 60 });
    expect(limited.headers["retry-after"]).toBe("60");
  });
});
