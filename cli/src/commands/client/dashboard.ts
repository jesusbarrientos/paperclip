import { Command } from "commander";
import type { DashboardSummary } from "@paperclipai/shared";
import {
  addCommonClientOptions,
  apiPath,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface DashboardGetOptions extends BaseClientOptions {
}

export function registerDashboardCommands(program: Command): void {
  const dashboard = program.command("dashboard").description("Dashboard summary operations");

  addCommonClientOptions(
    dashboard
      .command("get")
      .description("Get dashboard summary")
      .action(async (opts: DashboardGetOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const row = await ctx.api.get<DashboardSummary>(apiPath`/api/dashboard`);
          printOutput(row, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      })
  );
}
