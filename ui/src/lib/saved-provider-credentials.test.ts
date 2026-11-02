import { describe, expect, it } from "vitest";
import type { CompanySecret } from "@paperclipai/shared";
import type { MyUserSecretEntry } from "../api/secrets";
import {
  savedProviderKeys,
  savedCodexSubscriptions,
} from "./saved-provider-credentials";
const secret = (overrides = {}) =>
  ({
    id: "s1",
    key: "ANTHROPIC_API_KEY",
    name: "Claude",
    scope: "company",
    status: "active",
    ...overrides,
  }) as CompanySecret;
const personal = (key = "ANTHROPIC_API_KEY.setup.abc", overrides = {}) =>
  ({
    definition: {
      id: "d1",
      key,
      name: "My Claude",
      status: "active",
      ...overrides,
    },
    secret: secret({ scope: "user" }),
  }) as MyUserSecretEntry;
describe("saved provider keys", () => {
  it("reuses canonical and setup keys with references, including normalized organization keys", () => {
    expect(
      savedProviderKeys(
        "ANTHROPIC_API_KEY",
        [personal()],
        [secret({ key: "anthropic_api_key" })],
      ),
    ).toEqual([
      {
        id: "user:d1",
        label: "My Claude (Your key)",
        binding: {
          type: "user_secret_ref",
          key: "ANTHROPIC_API_KEY.setup.abc",
          version: "latest",
        },
      },
      {
        id: "company:s1",
        label: "Claude (Organization key)",
        binding: { type: "secret_ref", secretId: "s1", version: "latest" },
      },
    ]);
  });
  it("excludes unavailable and wrong-provider credentials", () => {
    expect(
      savedProviderKeys(
        "ANTHROPIC_API_KEY",
        [
          personal("OPENAI_API_KEY"),
          personal(undefined, { status: "disabled" }),
          { ...personal(), secret: null },
          { ...personal(), secret: secret({ status: "archived" }) },
        ],
        [
          secret({ status: "disabled" }),
          secret({ scope: "user" }),
          secret({ key: "ANTHROPIC_API_KEY_OTHER" }),
        ],
      ),
    ).toEqual([]);
  });
});

it("lists only active organization Codex account connections", () => {
  const account = secret({ name: "CODEX_HOME_team" });
  expect(
    savedCodexSubscriptions([
      account,
      { ...account, status: "disabled" },
      secret(),
    ]),
  ).toEqual([
    {
      id: "company:s1",
      label: "ChatGPT account · team",
      binding: { type: "secret_ref", secretId: "s1", version: "latest" },
    },
  ]);
});
