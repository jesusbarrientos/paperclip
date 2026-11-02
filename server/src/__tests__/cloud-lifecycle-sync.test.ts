import { describe, expect, it, vi } from "vitest";
import {
  isCloudPinnedPrimaryCompany,
  notifyCloudOfPrimaryCompanyLifecycleChange,
} from "../services/cloud-lifecycle-sync.js";

const STACK_ID = "stack-lifecycle-sync";

const CLOUD_ENV = {
  PAPERCLIP_CLOUD_TENANT_SERVER_TOKEN: "tenant-token-test",
  PAPERCLIP_CLOUD_STACK_ID: STACK_ID,
  PAPERCLIP_CLOUD_API_ORIGIN: "https://cloud.example.test",
} as NodeJS.ProcessEnv;

describe("isCloudPinnedPrimaryCompany", () => {
  it("matches only a cloud-managed instance", () => {
    expect(isCloudPinnedPrimaryCompany(CLOUD_ENV)).toBe(true);
    // Self-hosted: no cloud signal, never primary.
    expect(isCloudPinnedPrimaryCompany({} as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("notifyCloudOfPrimaryCompanyLifecycleChange", () => {
  it("rings the harness doorbell with the tenant token and stack id", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ outcome: "archived" }), { status: 200 }));
    await notifyCloudOfPrimaryCompanyLifecycleChange({
      env: CLOUD_ENV,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe("https://cloud.example.test/v1/tenant/lifecycle-changed");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer tenant-token-test");
    expect(headers.get("x-paperclip-cloud-stack-id")).toBe(STACK_ID);
  });

  it("is a silent no-op for incomplete cloud metadata", async () => {
    const fetchImpl = vi.fn();
    await notifyCloudOfPrimaryCompanyLifecycleChange({
      env: { ...CLOUD_ENV, PAPERCLIP_CLOUD_API_ORIGIN: undefined } as NodeJS.ProcessEnv,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await notifyCloudOfPrimaryCompanyLifecycleChange({
      env: {} as NodeJS.ProcessEnv,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("retries transient failures a bounded number of times and never throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("connection refused");
    });
    const sleeps: number[] = [];
    await expect(
      notifyCloudOfPrimaryCompanyLifecycleChange({
        env: CLOUD_ENV,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      }),
    ).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([2_000, 10_000]);
  });

  it("does not retry once the harness answered, even non-2xx", async () => {
    // Any answer means the harness heard the ring; it does its own
    // verified read-back, so a 4xx outcome is final.
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "stack_not_found" }), { status: 404 }));
    await notifyCloudOfPrimaryCompanyLifecycleChange({
      env: CLOUD_ENV,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {
        throw new Error("must not sleep");
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
