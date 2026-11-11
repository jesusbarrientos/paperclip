import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import { API_PREFIX, type Machine } from "@paperclipai/shared";
import { openUrl } from "../../client/board-auth.js";
import { resolvePaperclipHomeDir } from "../../config/home.js";
import { isExecutableFile, resolveServiceShimPath } from "../../services/service-manager.js";
import { handleCommandError } from "../client/common.js";
import {
  normalizeServerUrl,
  parseHeaderPairs,
  readMachineConfig,
  resolveDefaultWorkspaceRoot,
  resolveExtraHeaders,
  resolveMachineConfigPath,
  resolveMachineDir,
  writeMachineConfig,
} from "./config.js";
import { runMachineDaemon } from "./daemon.js";
import { resolveApprovalUrl, startPairing, waitForPairingClaim } from "./pairing.js";
import {
  renderMachineLaunchdPlist,
  renderMachineSystemdUnit,
  resolveLaunchdPlistPath,
  resolveSystemdUnitPath,
  SYSTEMD_UNIT_NAME,
} from "./service.js";

const MACHINE_SELF_PATH = `${API_PREFIX}/machines/v1/self`;

interface PairOptions {
  server: string;
  name?: string;
  workspaceRoot?: string;
  header?: string[];
  browser?: boolean;
  force?: boolean;
}

interface StatusOptions {
  json?: boolean;
}

function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function registerMachineCommands(program: Command): void {
  const machine = program
    .command("machine")
    .description("Pair this computer with a Paperclip server and run commands for it");

  machine
    .command("pair")
    .description("Pair this computer as an execution machine")
    .requiredOption("--server <url>", "Paperclip server URL, e.g. https://paperclip.example.com")
    .option("--name <name>", "Machine name shown in Paperclip (defaults to the hostname)")
    .option("--workspace-root <path>", "Directory where workspaces are created on this machine")
    .option("--header <name:value>", "Extra HTTP header sent to the server (repeatable)", collect)
    .option("--no-browser", "Do not open the approval URL in a browser")
    .option("--force", "Replace an existing pairing", false)
    .action(async (opts: PairOptions) => {
      try {
        await pairMachine(opts);
      } catch (error) {
        handleCommandError(error);
      }
    });

  machine
    .command("run")
    .description("Run the machine daemon in the foreground")
    .action(async () => {
      try {
        const configPath = resolveMachineConfigPath();
        const config = readMachineConfig(configPath);
        if (!config?.credential) {
          throw new Error("This machine is not paired. Run `paperclipai machine pair --server <url>` first.");
        }
        process.exit(await runMachineDaemon(config, configPath));
      } catch (error) {
        handleCommandError(error);
      }
    });

  machine
    .command("status")
    .description("Show the pairing and whether the server still accepts this machine")
    .option("--json", "Output JSON", false)
    .action(async (opts: StatusOptions) => {
      try {
        await printStatus(opts);
      } catch (error) {
        handleCommandError(error);
      }
    });

  machine
    .command("install-service")
    .description("Write a launchd agent (macOS) or systemd user unit (Linux) that runs the daemon")
    .action(async () => {
      try {
        await installService();
      } catch (error) {
        handleCommandError(error);
      }
    });
}

async function pairMachine(opts: PairOptions): Promise<void> {
  const configPath = resolveMachineConfigPath();
  const existing = readMachineConfig(configPath);
  if (existing?.credential && !opts.force) {
    throw new Error(
      `This computer is already paired as machine ${existing.machineId} with ${existing.serverUrl}. Use --force to pair again.`,
    );
  }

  const serverUrl = normalizeServerUrl(opts.server);
  const configHeaders = parseHeaderPairs(opts.header ?? []);
  const headers = resolveExtraHeaders({ headers: configHeaders });
  const hostname = os.hostname();
  const name = (opts.name?.trim() || hostname || "machine").slice(0, 80);
  const workspaceRoot = path.resolve(opts.workspaceRoot ?? resolveDefaultWorkspaceRoot());

  const pairing = await startPairing(
    serverUrl,
    { name, platform: process.platform, arch: process.arch, hostname: hostname || null },
    { headers },
  );
  const approvalUrl = resolveApprovalUrl(serverUrl, pairing);

  console.log("");
  console.log(`Approve this machine in Paperclip (sign in if asked):`);
  console.log(`  ${pc.bold(pc.cyan(approvalUrl))}`);
  console.log("");
  if (opts.browser !== false) await openUrl(approvalUrl);
  console.log(pc.dim(`Waiting for approval (expires ${new Date(pairing.expiresAt).toLocaleTimeString()})...`));

  const claimed = await waitForPairingClaim(serverUrl, pairing, {
    headers,
    onTransientError: (message) => console.error(pc.yellow(`Server not reachable (${message}); still waiting...`)),
  });

  writeMachineConfig(
    {
      serverUrl,
      machineId: claimed.machineId,
      credential: claimed.credential,
      workspaceRoot,
      name,
      ...(Object.keys(configHeaders).length > 0 ? { headers: configHeaders } : {}),
    },
    configPath,
  );
  fs.mkdirSync(workspaceRoot, { recursive: true });

  console.log(pc.green(`Paired as "${name}" (${claimed.machineId}).`));
  console.log(`Credential stored in ${configPath}`);
  console.log(`Start the daemon with: ${pc.bold("paperclipai machine run")}`);
  console.log(`Or run it in the background: ${pc.bold("paperclipai machine install-service")}`);
}

type SelfCheck =
  | { state: "authorized"; machine: Machine }
  | { state: "revoked"; httpStatus: number }
  | { state: "error"; httpStatus: number }
  | { state: "unreachable"; error: string };

async function checkSelf(serverUrl: string, credential: string, headers: Record<string, string>): Promise<SelfCheck> {
  let response: Response;
  try {
    response = await fetch(`${serverUrl}${MACHINE_SELF_PATH}`, {
      headers: { ...headers, authorization: `Bearer ${credential}`, accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    return { state: "unreachable", error: error instanceof Error ? error.message : String(error) };
  }
  if (response.status === 401) return { state: "revoked", httpStatus: 401 };
  if (!response.ok) return { state: "error", httpStatus: response.status };
  return { state: "authorized", machine: await response.json() as Machine };
}

async function printStatus(opts: StatusOptions): Promise<void> {
  const configPath = resolveMachineConfigPath();
  const config = readMachineConfig(configPath);
  if (!config) {
    if (opts.json) console.log(JSON.stringify({ paired: false, configPath }, null, 2));
    else console.log(`Not paired (no config at ${configPath}). Run \`paperclipai machine pair --server <url>\`.`);
    return;
  }

  const summary = {
    configPath,
    serverUrl: config.serverUrl,
    machineId: config.machineId,
    name: config.name ?? null,
    workspaceRoot: config.workspaceRoot,
    hasCredential: Boolean(config.credential),
    extraHeaders: Object.keys(resolveExtraHeaders(config)),
  };
  const check = config.credential
    ? await checkSelf(config.serverUrl, config.credential, resolveExtraHeaders(config))
    : null;

  if (opts.json) {
    console.log(JSON.stringify({ paired: Boolean(config.credential), ...summary, server: check }, null, 2));
    return;
  }

  console.log(`Config:         ${summary.configPath}`);
  console.log(`Server:         ${summary.serverUrl}`);
  console.log(`Machine:        ${summary.name ? `${summary.name} ` : ""}(${summary.machineId})`);
  console.log(`Workspace root: ${summary.workspaceRoot}`);
  if (summary.extraHeaders.length > 0) console.log(`Extra headers:  ${summary.extraHeaders.join(", ")}`);
  if (!check) {
    console.log(pc.yellow("Credential:     missing (revoked or never paired). Run `paperclipai machine pair` again."));
    return;
  }
  switch (check.state) {
    case "authorized":
      console.log(pc.green(`Server:         reachable, authorized (status ${check.machine.status}, ${check.machine.connected ? "connected" : "not connected"})`));
      return;
    case "revoked":
      console.log(pc.red("Server:         reachable, credential rejected (machine revoked or unknown)"));
      return;
    case "error":
      console.log(pc.yellow(`Server:         reachable, unexpected HTTP ${check.httpStatus}`));
      return;
    case "unreachable":
      console.log(pc.red(`Server:         unreachable (${check.error})`));
      return;
  }
}

async function resolveDaemonProgramArguments(): Promise<string[]> {
  const shimPath = resolveServiceShimPath();
  if (await isExecutableFile(shimPath)) return [shimPath, "machine", "run"];
  const entry = process.argv[1] ? fs.realpathSync(process.argv[1]) : null;
  if (!entry || entry.endsWith(".ts")) {
    throw new Error(`No installed paperclipai found at ${shimPath}. Install the CLI or set PAPERCLIP_SHIM_PATH to its executable.`);
  }
  return [process.execPath, entry, "machine", "run"];
}

async function installService(): Promise<void> {
  if (process.platform !== "darwin" && process.platform !== "linux") {
    console.log(`install-service is not supported on ${process.platform}. Run \`paperclipai machine run\` with your own supervisor.`);
    return;
  }
  const input = {
    programArguments: await resolveDaemonProgramArguments(),
    paperclipHome: resolvePaperclipHomeDir(),
    pathEnv: servicePath(process.env.PATH),
    logPath: path.join(resolveMachineDir(), "daemon.log"),
  };

  if (process.platform === "darwin") {
    const plistPath = resolveLaunchdPlistPath();
    writeServiceFile(plistPath, renderMachineLaunchdPlist(input));
    console.log(`Wrote ${plistPath}`);
    console.log("Load it with:");
    console.log(`  launchctl bootstrap gui/$(id -u) ${plistPath}`);
    console.log("Stop and unload it with:");
    console.log(`  launchctl bootout gui/$(id -u) ${plistPath}`);
    console.log(`Logs: ${input.logPath}`);
    return;
  }

  const unitPath = resolveSystemdUnitPath();
  writeServiceFile(unitPath, renderMachineSystemdUnit(input));
  console.log(`Wrote ${unitPath}`);
  console.log("Enable and start it with:");
  console.log("  systemctl --user daemon-reload");
  console.log(`  systemctl --user enable --now ${SYSTEMD_UNIT_NAME}`);
  console.log("To keep it running after you log out:");
  console.log("  loginctl enable-linger $USER");
  console.log(`Logs: journalctl --user -u ${SYSTEMD_UNIT_NAME} -f`);
}

export function servicePath(value: string | undefined): string {
  const entries = (value ?? "").split(path.delimiter).filter((entry) => entry && !entry.includes(`node_modules${path.sep}.bin`));
  const unique = [...new Set(entries)];
  return unique.length > 0 ? unique.join(path.delimiter) : "/usr/local/bin:/usr/bin:/bin";
}

function writeServiceFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.mkdirSync(resolveMachineDir(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, content, { encoding: "utf8", mode: 0o644 });
}
