import type { APIRequestContext } from "@playwright/test";

export type Organization = {
  id: string;
  name: string;
  issuePrefix: string;
  status?: string;
  [key: string]: unknown;
};

async function readJson<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>, label: string): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${label} → ${response.status()}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

/**
 * The instance serves one organization shared by every spec: create it on
 * first use and reuse it afterwards. `name` only applies when this call
 * creates it.
 */
export async function ensureOrganization(
  request: APIRequestContext,
  options: { baseUrl?: string; name?: string } = {},
): Promise<Organization> {
  const base = options.baseUrl ?? "";
  const existing = await request.get(`${base}/api/organization`);
  if (existing.ok()) return (await existing.json()) as Organization;
  if (existing.status() !== 404) {
    throw new Error(`GET /api/organization → ${existing.status()}: ${await existing.text()}`);
  }
  const created = await request.post(`${base}/api/organization`, {
    data: { name: options.name ?? "E2E Organization" },
  });
  // A concurrent caller may have created it between the GET and the POST.
  if (created.status() === 409) {
    return readJson<Organization>(await request.get(`${base}/api/organization`), "GET /api/organization");
  }
  return readJson<Organization>(created, "POST /api/organization");
}
