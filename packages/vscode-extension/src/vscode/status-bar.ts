import * as vscode from "vscode";
import type { ActiveIssueSnapshot } from "../core/active-issue.js";

export function statusText(snapshot: ActiveIssueSnapshot | null, signedIn: boolean) {
  if (!signedIn) return { text: "$(circle-slash) Paperclip", tooltip: "Sign in to Paperclip" };
  if (!snapshot) return { text: "$(issues) Paperclip", tooltip: "Select a Paperclip issue" };
  const run = snapshot.state?.run;
  const where = snapshot.state?.machine?.name ?? "Server";
  const icon = run ? "$(sync~spin)" : snapshot.state?.pendingRuntimeRequestCount ? "$(bell-dot)" : "$(issues)";
  const label = snapshot.issue.identifier ?? snapshot.issue.title;
  const lock = snapshot.state?.context?.editLocked ? " $(lock)" : "";
  return {
    text: `${icon} ${label} · ${where}${lock}`,
    tooltip: [
      snapshot.issue.title,
      `Runs on: ${where}${snapshot.state?.machine && !snapshot.state.machine.connected ? " (offline)" : ""}`,
      run ? `Run: ${run.status.replace(/_/g, " ")}` : "No active run",
      snapshot.state?.pendingRuntimeRequestCount ? `${snapshot.state.pendingRuntimeRequestCount} permission request(s) pending` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export class StatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);

  constructor() {
    this.item.command = "paperclip.openChat";
    this.item.show();
  }

  update(snapshot: ActiveIssueSnapshot | null, signedIn: boolean) {
    const { text, tooltip } = statusText(snapshot, signedIn);
    this.item.text = text;
    this.item.tooltip = tooltip;
    this.item.command = signedIn ? (snapshot ? "paperclip.openChat" : "paperclip.selectIssue") : "paperclip.signIn";
  }

  dispose() {
    this.item.dispose();
  }
}
