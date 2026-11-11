import type { LocalMachine } from "./machine-config.js";
import { sameServer } from "./machine-config.js";
import type { Machine } from "./types.js";

export type LocalMachineState =
  | { kind: "unpaired" }
  | { kind: "other_server"; machine: LocalMachine }
  | { kind: "credential_missing"; machine: LocalMachine }
  | { kind: "paired"; machine: LocalMachine };

export function describeLocalMachine(local: LocalMachine | null, serverUrl: string): LocalMachineState {
  if (!local) return { kind: "unpaired" };
  if (!sameServer(local.serverUrl, serverUrl)) return { kind: "other_server", machine: local };
  if (!local.paired) return { kind: "credential_missing", machine: local };
  return { kind: "paired", machine: local };
}

export interface CliInvocation {
  command: string;
  args: string[];
}

export function daemonRunInvocation(cliPath: string): CliInvocation {
  return { command: cliPath, args: ["machine", "run"] };
}

export function pairInvocation(cliPath: string, serverUrl: string, name?: string): CliInvocation {
  return {
    command: cliPath,
    args: ["machine", "pair", "--server", serverUrl, ...(name ? ["--name", name] : [])],
  };
}

export function shellLine(invocation: CliInvocation, platform: NodeJS.Platform = process.platform): string {
  const quote =
    platform === "win32"
      ? (value: string) => (/^[\w./:=-]+$/.test(value) ? value : `'${value.replace(/'/g, "''")}'`)
      : (value: string) => (/^[\w./:=@-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`);
  const command = quote(invocation.command);
  return [platform === "win32" && command.startsWith("'") ? `& ${command}` : command, ...invocation.args.map(quote)].join(" ");
}

export type DaemonAction = "none" | "pair" | "start";

/** The server's view of the connection wins over the local file. */
export function daemonActionFor(state: LocalMachineState, remote: Pick<Machine, "connected" | "status"> | null): DaemonAction {
  if (state.kind !== "paired") return "pair";
  if (remote?.status === "revoked") return "pair";
  return remote?.connected ? "none" : "start";
}
