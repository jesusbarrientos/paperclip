import { Command } from "commander";
import type { Company } from "@paperclipai/shared";
import {
  addCommonClientOptions,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";
import { registerOrganizationPortabilityCommands } from "./organization-portability.js";

interface OrganizationUpdateOptions extends BaseClientOptions {
  payloadJson?: string;
}

export function registerOrganizationCommands(program: Command): void {
  const organization = program.command("organization").description("Organization operations");

  addCommonClientOptions(
    organization
      .command("get")
      .description("Get the organization served by this instance")
      .action(async (opts: BaseClientOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          printOutput(await ctx.api.get<Company>("/api/organization"), { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    organization
      .command("update")
      .description("Update the organization")
      .requiredOption("--payload-json <json>", "Organization update JSON payload")
      .action(async (opts: OrganizationUpdateOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          printOutput(await ctx.api.patch<Company>("/api/organization", parseJson(opts.payloadJson ?? "{}")), { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  registerOrganizationPortabilityCommands(organization);
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}
