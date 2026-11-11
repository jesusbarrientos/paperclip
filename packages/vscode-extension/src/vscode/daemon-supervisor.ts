import { spawn, type ChildProcess } from "node:child_process";
import * as vscode from "vscode";
import type { PaperclipApi } from "../core/api-client.js";
import {
  daemonActionFor,
  daemonRunInvocation,
  describeLocalMachine,
  pairInvocation,
  shellLine,
  type LocalMachineState,
} from "../core/daemon.js";
import { readLocalMachine } from "../core/machine-config.js";
import type { Machine } from "../core/types.js";

const CONNECT_WAIT_MS = 20_000;

function cliPath() {
  return vscode.workspace.getConfiguration("paperclip").get<string>("cliPath", "paperclipai");
}

/** A daemon started here is a child of the extension host and stops with the window, which pauses this window's machine runs. */
export class DaemonSupervisor implements vscode.Disposable {
  private child: ChildProcess | null = null;
  private readonly output = vscode.window.createOutputChannel("Paperclip Machine");

  localState(serverUrl: string): LocalMachineState {
    return describeLocalMachine(readLocalMachine(), serverUrl);
  }

  async remoteMachine(api: PaperclipApi, state: LocalMachineState): Promise<Machine | null> {
    if (state.kind === "unpaired" || state.kind === "other_server") return null;
    try {
      return await api.getMachine(state.machine.machineId);
    } catch {
      return null;
    }
  }

  async ensureConnected(api: PaperclipApi, options: { autoStart: boolean }): Promise<Machine | null> {
    const state = this.localState(api.serverUrl);
    const remote = await this.remoteMachine(api, state);
    const action = daemonActionFor(state, remote);
    if (action === "none") return remote;
    if (action === "pair") {
      const choice = await vscode.window.showWarningMessage(
        state.kind === "other_server"
          ? `This machine is paired with ${state.machine.serverUrl}, not ${api.serverUrl}.`
          : "This machine is not paired with Paperclip yet.",
        "Pair This Machine",
      );
      if (choice) this.pair(api.serverUrl);
      return null;
    }
    if (!options.autoStart) {
      const choice = await vscode.window.showWarningMessage("The Paperclip machine daemon is not running.", "Start Daemon");
      if (!choice) return null;
    }
    this.start();
    return this.waitForConnection(api, state);
  }

  private async waitForConnection(api: PaperclipApi, state: LocalMachineState) {
    const deadline = Date.now() + CONNECT_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const remote = await this.remoteMachine(api, state);
      if (remote?.connected) return remote;
      if (!this.child) break;
    }
    this.output.show(true);
    void vscode.window.showErrorMessage("The machine daemon did not connect. See the Paperclip Machine output.");
    return null;
  }

  start() {
    if (this.child) return;
    const invocation = daemonRunInvocation(cliPath());
    this.output.appendLine(`$ ${shellLine(invocation)}`);
    const child = spawn(invocation.command, invocation.args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    this.child = child;
    child.stdout?.on("data", (chunk: Buffer) => this.output.append(chunk.toString("utf8")));
    child.stderr?.on("data", (chunk: Buffer) => this.output.append(chunk.toString("utf8")));
    child.on("error", (error) => {
      this.output.appendLine(`Could not start the daemon: ${error.message}`);
      if (this.child === child) this.child = null;
    });
    child.on("exit", (code, signal) => {
      this.output.appendLine(`Daemon exited (${signal ?? code})`);
      if (this.child === child) this.child = null;
    });
  }

  /** Pairing needs the user to approve in the browser, so it runs visibly in a terminal. */
  pair(serverUrl: string) {
    const terminal = vscode.window.createTerminal({ name: "Paperclip: Pair Machine" });
    terminal.show();
    terminal.sendText(shellLine(pairInvocation(cliPath(), serverUrl)));
  }

  get startedHere() {
    return this.child !== null;
  }

  dispose() {
    this.child?.kill("SIGTERM");
    this.child = null;
    this.output.dispose();
  }
}
