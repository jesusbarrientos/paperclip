import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import type { ActiveIssueSnapshot } from "../core/active-issue.js";
import { requestChoices } from "../core/transcript.js";

export type ChatPanelMessage =
  | { type: "send"; body: string }
  | { type: "interrupt" }
  | { type: "resolve"; requestId: string; action: string }
  | { type: "openInBrowser" }
  | { type: "inspectRun" }
  | { type: "ready" };

/** Adds the resolvable choices to each request entry so the webview never decides which actions are valid. */
export function toWebviewSnapshot(snapshot: ActiveIssueSnapshot) {
  return {
    ...snapshot,
    transcript: snapshot.transcript
      ? {
          ...snapshot.transcript,
          entries: snapshot.transcript.entries.map((entry) =>
            entry.kind === "request" ? { ...entry, actions: entry.status === "pending" ? requestChoices(entry) : [] } : entry,
          ),
        }
      : null,
  };
}

export class ChatPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private last: ActiveIssueSnapshot | null = null;

  constructor(private readonly onMessage: (message: ChatPanelMessage) => void) {}

  show() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
      return;
    }
    const panel = vscode.window.createWebviewPanel("paperclip.chat", "Paperclip", {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: true,
    }, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [] });
    panel.webview.html = renderHtml(panel.webview);
    panel.webview.onDidReceiveMessage((message: ChatPanelMessage) => {
      if (message.type === "ready") {
        this.post();
        return;
      }
      this.onMessage(message);
    });
    panel.onDidDispose(() => {
      this.panel = null;
    });
    this.panel = panel;
  }

  update(snapshot: ActiveIssueSnapshot | null) {
    this.last = snapshot;
    if (this.panel) {
      this.panel.title = snapshot ? `Paperclip: ${snapshot.issue.identifier ?? snapshot.issue.title}` : "Paperclip";
    }
    this.post();
  }

  private post() {
    void this.panel?.webview.postMessage({
      type: "snapshot",
      snapshot: this.last ? toWebviewSnapshot(this.last) : null,
    });
  }

  dispose() {
    this.panel?.dispose();
    this.panel = null;
  }
}

function renderHtml(webview: vscode.Webview) {
  const nonce = randomBytes(16).toString("base64");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="${nonce}">
  body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); margin: 0; display: flex; flex-direction: column; height: 100vh; }
  header { padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  header .title { font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { color: var(--vscode-descriptionForeground); font-size: 0.9em; }
  main { flex: 1; overflow-y: auto; padding: 8px 12px; }
  .msg { margin: 6px 0; padding: 6px 8px; border-radius: 4px; background: var(--vscode-editor-inactiveSelectionBackground); white-space: pre-wrap; word-break: break-word; }
  .msg .who { font-size: 0.85em; color: var(--vscode-descriptionForeground); margin-bottom: 2px; }
  .msg.pending { opacity: 0.6; }
  .msg.failed { border-left: 3px solid var(--vscode-errorForeground); }
  h3 { font-size: 0.9em; text-transform: uppercase; color: var(--vscode-descriptionForeground); margin: 14px 0 4px; }
  .entry { margin: 4px 0; white-space: pre-wrap; word-break: break-word; }
  .tool { font-family: var(--vscode-editor-font-family); font-size: 0.9em; color: var(--vscode-descriptionForeground); }
  .error { color: var(--vscode-errorForeground); }
  .thinking { color: var(--vscode-descriptionForeground); font-style: italic; }
  .blocker { margin: 10px 0; padding: 8px; border-left: 3px solid var(--vscode-editorWarning-foreground); background: var(--vscode-editor-inactiveSelectionBackground); }
  .blocker p { margin: 0 0 4px; }
  .request { border: 1px solid var(--vscode-focusBorder); border-radius: 4px; padding: 6px 8px; margin: 6px 0; }
  .request .actions { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
  footer { border-top: 1px solid var(--vscode-panel-border); padding: 8px 12px; display: flex; gap: 6px; }
  textarea { flex: 1; resize: vertical; min-height: 2.5em; font-family: inherit; font-size: inherit; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); padding: 4px; }
  button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: none; padding: 4px 10px; cursor: pointer; border-radius: 2px; }
  button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
  button:disabled { opacity: 0.5; cursor: default; }
  .empty { color: var(--vscode-descriptionForeground); padding: 16px 0; }
</style>
</head>
<body>
<header>
  <span class="title" id="title">No issue selected</span>
  <span class="meta" id="meta"></span>
  <button class="secondary" id="interrupt" hidden>Interrupt</button>
  <button class="secondary" id="browser">Open in browser</button>
</header>
<main id="log"><div class="empty">Select an issue in the Paperclip view.</div></main>
<footer>
  <textarea id="input" placeholder="Message the agent (Ctrl+Enter to send)"></textarea>
  <button id="send">Send</button>
</footer>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  let current = null;

  function render(snapshot) {
    current = snapshot;
    const log = $("log");
    const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 20;
    log.replaceChildren();
    if (!snapshot) {
      $("title").textContent = "No issue selected";
      $("meta").textContent = "";
      $("interrupt").hidden = true;
      log.append(el("div", "empty", "Select an issue in the Paperclip view."));
      return;
    }
    const issue = snapshot.issue;
    $("title").textContent = (issue.identifier ? issue.identifier + " " : "") + issue.title;
    const run = snapshot.state && snapshot.state.run;
    const machine = snapshot.state && snapshot.state.machine;
    const where = machine ? machine.name : "Server";
    const parts = [issue.status.replace(/_/g, " "), "runs on " + where];
    if (run) parts.push("run " + run.status.replace(/_/g, " "));
    if (snapshot.state && snapshot.state.context && snapshot.state.context.editLocked) parts.push("edits locked");
    if (snapshot.streamStatus !== "open") parts.push(snapshot.streamStatus);
    $("meta").textContent = parts.join(" · ");
    $("interrupt").hidden = !run;
    $("interrupt").disabled = snapshot.interrupting;
    $("interrupt").textContent = snapshot.interrupting ? "Interrupting…" : "Interrupt";

    if (snapshot.error) log.append(el("div", "entry error", snapshot.error));
    for (const message of snapshot.messages) {
      const node = el("div", "msg" + (message.pending ? " pending" : "") + (message.failed ? " failed" : ""));
      node.append(el("div", "who", message.authorLabel + (message.failed ? " · not sent" : message.pending ? " · sending" : "")));
      node.append(el("div", "", message.body));
      log.append(node);
    }
    const transcript = snapshot.transcript;
    if (transcript && transcript.entries.length > 0) {
      log.append(el("h3", "", "Run " + transcript.runId.slice(0, 8) + (transcript.runStatus ? " · " + transcript.runStatus.replace(/_/g, " ") : "")));
      for (const entry of transcript.entries) log.append(renderEntry(entry));
    }
    if (snapshot.messages.length === 0 && !transcript) log.append(el("div", "empty", "No messages yet."));
    if (issue.executionBlocker) log.append(renderBlocker(issue.executionBlocker));
    if (stick) log.scrollTop = log.scrollHeight;
  }

  function renderBlocker(blocker) {
    const node = el("div", "blocker");
    node.setAttribute("role", "status");
    node.append(el("p", "", "Recovery needed." + (blocker.runError ? " " + blocker.runError : "")));
    node.append(el("p", "", blocker.nextAction));
    if (blocker.savedMessageCount) {
      node.append(el("p", "meta", blocker.savedMessageCount + (blocker.savedMessageCount === 1 ? " saved message is" : " saved messages are") + " waiting for recovery."));
    }
    if (blocker.agentId && blocker.runId) {
      const inspect = el("button", "secondary", "Inspect run");
      inspect.addEventListener("click", () => vscode.postMessage({ type: "inspectRun" }));
      node.append(inspect);
    }
    return node;
  }

  function renderEntry(entry) {
    switch (entry.kind) {
      case "assistant": return el("div", "entry", entry.text + (entry.streaming ? " …" : ""));
      case "thinking": return el("div", "entry thinking", entry.text);
      case "tool": {
        const mark = entry.status === "running" ? "…" : entry.status === "ok" ? "✓" : "✗";
        return el("div", "entry tool" + (entry.status === "error" ? " error" : ""), mark + " " + entry.name + (entry.detail ? " " + entry.detail : ""));
      }
      case "error": return el("div", "entry error", entry.text);
      case "notice": return el("div", "entry meta", entry.text);
      case "request": {
        const node = el("div", "request");
        node.append(el("div", "", entry.prompt));
        if (entry.status !== "pending") {
          node.append(el("div", "meta", entry.status + (entry.resolvedAction ? " (" + entry.resolvedAction + ")" : "")));
        } else if (entry.input) {
          node.append(el("div", "meta", "This request needs a form. Answer it in the browser."));
        } else {
          const actions = el("div", "actions");
          for (const choice of entry.actions) {
            const button = el("button", choice.key === "accept" || choice.key === "accept_for_session" ? "" : "secondary", choice.label);
            button.addEventListener("click", () => {
              button.disabled = true;
              vscode.postMessage({ type: "resolve", requestId: entry.requestId, action: choice.key });
            });
            actions.append(button);
          }
          node.append(actions);
        }
        return node;
      }
    }
    return el("div");
  }

  function send() {
    const input = $("input");
    const body = input.value.trim();
    if (!body || !current) return;
    vscode.postMessage({ type: "send", body });
    input.value = "";
  }

  $("send").addEventListener("click", send);
  $("input").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); send(); }
  });
  $("interrupt").addEventListener("click", () => vscode.postMessage({ type: "interrupt" }));
  $("browser").addEventListener("click", () => vscode.postMessage({ type: "openInBrowser" }));
  window.addEventListener("message", (event) => { if (event.data && event.data.type === "snapshot") render(event.data.snapshot); });
  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
}
