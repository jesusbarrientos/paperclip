import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import WebSocket from "ws";
import { ApiError, type PaperclipApi } from "./core/api-client.js";
import { ActiveIssue } from "./core/active-issue.js";
import { ClientSessionHeartbeat } from "./core/client-session.js";
import type { SocketFactory } from "./core/live-events.js";
import { readLocalMachine, resolvePaperclipHome } from "./core/machine-config.js";
import type { ExecutionLocation, WorkContextState } from "./core/types.js";
import { ChatPanel, type ChatPanelMessage } from "./vscode/chat-panel.js";
import { DaemonSupervisor } from "./vscode/daemon-supervisor.js";
import { IssuesTreeProvider } from "./vscode/issues-tree.js";
import { describeSignInError, PaperclipSession } from "./vscode/session.js";
import { StatusBar } from "./vscode/status-bar.js";
import { WorkspaceController } from "./vscode/workspace-controller.js";

const SELECTED_ISSUE_KEY = "paperclip.selectedIssueId";

const createSocket: SocketFactory = (url, headers) => new WebSocket(url, { headers });

let clientSession: ClientSessionHeartbeat | null = null;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function activate(context: vscode.ExtensionContext) {
  const session = new PaperclipSession(context.secrets);
  const tree = new IssuesTreeProvider(session);
  const workspace = new WorkspaceController(context.workspaceState, resolvePaperclipHome());
  const daemon = new DaemonSupervisor();
  const statusBar = new StatusBar();
  let active: ActiveIssue | null = null;
  let appliedWorkspaceKey: string | null = null;

  const chat = new ChatPanel((message) => void handleChatMessage(message));
  context.subscriptions.push(
    session,
    tree,
    daemon,
    statusBar,
    chat,
    vscode.window.registerTreeDataProvider("paperclip.issues", tree),
  );

  function requireApi(): PaperclipApi | null {
    if (session.api) return session.api;
    void vscode.window.showWarningMessage("Sign in to Paperclip first.", "Sign In").then((choice) => {
      if (choice) void vscode.commands.executeCommand("paperclip.signIn");
    });
    return null;
  }

  function requireActive(): ActiveIssue | null {
    if (active) return active;
    void vscode.window.showWarningMessage("Select a Paperclip issue first.");
    return null;
  }

  function render() {
    const snapshot = active?.snapshot() ?? null;
    chat.update(snapshot);
    statusBar.update(snapshot, Boolean(session.api));
    if (active) void syncWorkspace(active.workContext);
  }

  /** Shows the issue's folders only when its context lives on this machine; files elsewhere are not reachable yet. */
  async function syncWorkspace(state: WorkContextState | null) {
    const local = readLocalMachine();
    const here = Boolean(local && state?.context?.machineId && state.context.machineId === local.machineId);
    const folders = here ? workspace.contextFolders(state?.context?.remotePath ?? null) : [];
    const locked = Boolean(state?.context?.editLocked);
    const key = JSON.stringify([folders, locked]);
    if (key === appliedWorkspaceKey) return;
    appliedWorkspaceKey = key;
    const result = await workspace.showFolders(folders);
    if (!result.switched && result.reason === "unsaved") {
      appliedWorkspaceKey = null;
      void vscode.window.showWarningMessage("Save or discard your changes before switching to this issue's files.");
      return;
    }
    await workspace.setReadonly(locked ? folders : []);
  }

  async function selectIssue(issueId: string) {
    const api = requireApi();
    if (!api) return;
    const issue = tree.findIssue(issueId) ?? (await api.getIssue(issueId).catch(() => null));
    if (!issue) {
      void vscode.window.showErrorMessage("That issue is no longer available.");
      return;
    }
    active?.dispose();
    const agents = await api.listAgents().catch(() => []);
    active = new ActiveIssue(issue, api, { createSocket, agents, onChange: render });
    appliedWorkspaceKey = null;
    tree.setActiveIssue(issue.id);
    await context.workspaceState.update(SELECTED_ISSUE_KEY, issue.id);
    render();
    chat.show();
    await active.start();
  }

  async function pickIssue() {
    const api = requireApi();
    if (!api) return;
    await tree.getChildren();
    const picked = await vscode.window.showQuickPick(
      tree.allIssues().map((issue) => ({
        label: `${issue.identifier ? `${issue.identifier} ` : ""}${issue.title}`,
        description: issue.status.replace(/_/g, " "),
        issueId: issue.id,
      })),
      { placeHolder: "Select a Paperclip issue" },
    );
    if (picked) await selectIssue(picked.issueId);
  }

  async function thisMachineLocation(api: PaperclipApi): Promise<ExecutionLocation | null> {
    const autoStart = vscode.workspace.getConfiguration("paperclip").get<boolean>("autoStartDaemon", true);
    const machine = await daemon.ensureConnected(api, { autoStart });
    return machine ? { kind: "machine", machineId: machine.id } : null;
  }

  async function runAt(target: "here" | "server") {
    const api = requireApi();
    const current = requireActive();
    if (!api || !current) return;
    try {
      const location = target === "here" ? await thisMachineLocation(api) : ({ kind: "server" } as const);
      if (!location) return;
      const result = await api.runWorkContext(current.id, {
        location,
        clientSessionId: location.kind === "machine" ? (clientSession?.id ?? null) : null,
      });
      current.replaceState(result.state);
    } catch (error) {
      if (error instanceof ApiError && error.isConflict) {
        void vscode.window.showWarningMessage(`${error.message} Use "Move Work" to change where it runs.`);
        return;
      }
      void vscode.window.showErrorMessage(`Could not start the run: ${errorText(error)}`);
    }
  }

  async function moveTo(target: "here" | "server") {
    const api = requireApi();
    const current = requireActive();
    if (!api || !current) return;
    try {
      const location = target === "here" ? await thisMachineLocation(api) : ({ kind: "server" } as const);
      if (!location) return;
      const result = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Moving the work…" },
        () => api.handoff(current.id, location),
      );
      current.replaceState(result.state);
    } catch (error) {
      const state = error instanceof ApiError ? (error.body as { state?: WorkContextState } | null)?.state : undefined;
      if (state) current.replaceState(state);
      void vscode.window.showErrorMessage(`Could not move the work: ${errorText(error)}`);
    }
  }

  async function handleChatMessage(message: ChatPanelMessage) {
    const current = active;
    if (!current) return;
    switch (message.type) {
      case "send":
        await current.sendComment(message.body);
        return;
      case "interrupt":
        await current.interrupt();
        return;
      case "resolve":
        await current.resolveRequest(message.requestId, message.action);
        return;
      case "openInBrowser":
        await vscode.commands.executeCommand("paperclip.openInBrowser");
        return;
      case "inspectRun": {
        const blocker = current.snapshot().issue.executionBlocker;
        if (session.api && blocker?.agentId && blocker.runId) {
          await vscode.env.openExternal(vscode.Uri.parse(session.api.runUrl(blocker.agentId, blocker.runId)));
        }
        return;
      }
    }
  }

  function startClientSession() {
    void clientSession?.close();
    clientSession = null;
    if (!session.api) return;
    clientSession = new ClientSessionHeartbeat({ api: session.api, clientSessionId: randomUUID() });
    clientSession.start();
  }

  const register = (command: string, handler: (...args: never[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(command, handler));

  register("paperclip.signIn", async () => {
    try {
      await session.signIn();
    } catch (error) {
      const text = describeSignInError(error);
      if (text) void vscode.window.showErrorMessage(`Sign in failed: ${text}`);
    }
  });
  register("paperclip.signOut", async () => {
    active?.dispose();
    active = null;
    await session.signOut();
  });
  register("paperclip.selectIssue", async (issueId?: string) => {
    if (typeof issueId === "string") await selectIssue(issueId);
    else await pickIssue();
  });
  register("paperclip.openChat", () => {
    chat.show();
    render();
  });
  register("paperclip.runOnThisMachine", () => runAt("here"));
  register("paperclip.runOnServer", () => runAt("server"));
  register("paperclip.moveToServer", () => moveTo("server"));
  register("paperclip.moveToThisMachine", () => moveTo("here"));
  register("paperclip.interruptRun", async () => {
    await requireActive()?.interrupt();
  });
  register("paperclip.openInBrowser", async (node?: { issue?: { id: string; identifier: string | null } }) => {
    const api = requireApi();
    const issue = node?.issue ?? active?.snapshot().issue;
    if (!api || !issue) return;
    await vscode.env.openExternal(vscode.Uri.parse(api.issueUrl(issue)));
  });
  register("paperclip.refresh", async () => {
    tree.refresh();
    await active?.refreshAll();
  });
  register("paperclip.pairMachine", () => daemon.pair(session.serverUrl));
  register("paperclip.startDaemon", () => daemon.start());
  register("paperclip.openManagedWorkspace", () => workspace.openManagedWorkspace());

  context.subscriptions.push(
    session.onDidChange(() => {
      tree.refresh();
      startClientSession();
      render();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("paperclip.serverUrl")) {
        active?.dispose();
        active = null;
        void session.restore();
      }
    }),
    { dispose: () => active?.dispose() },
  );

  await session.restore();
  const remembered = context.workspaceState.get<string>(SELECTED_ISSUE_KEY);
  if (session.api && remembered) await selectIssue(remembered).catch(() => undefined);
}

export async function deactivate() {
  await clientSession?.close();
  clientSession = null;
}
