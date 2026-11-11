import * as vscode from "vscode";
import type { IssueSummary, ProjectSummary } from "../core/types.js";
import type { PaperclipSession } from "./session.js";

const OPEN_STATUSES = ["backlog", "todo", "in_progress", "in_review", "blocked"];
const NO_PROJECT = "__none__";

type Node =
  | { kind: "project"; id: string; name: string; issues: IssueSummary[] }
  | { kind: "issue"; issue: IssueSummary }
  | { kind: "message"; text: string };

/** Lists every open issue the user can see, grouped by project, regardless of the folder open in this window. */
export class IssuesTreeProvider implements vscode.TreeDataProvider<Node>, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private roots: Node[] | null = null;
  private activeIssueId: string | null = null;

  constructor(private readonly session: PaperclipSession) {}

  refresh() {
    this.roots = null;
    this.changed.fire(undefined);
  }

  setActiveIssue(issueId: string | null) {
    this.activeIssueId = issueId;
    this.changed.fire(undefined);
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === "message") {
      return new vscode.TreeItem(node.text, vscode.TreeItemCollapsibleState.None);
    }
    if (node.kind === "project") {
      const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.Expanded);
      item.description = String(node.issues.length);
      item.contextValue = "project";
      return item;
    }
    const issue = node.issue;
    const item = new vscode.TreeItem(
      `${issue.identifier ? `${issue.identifier} ` : ""}${issue.title}`,
      vscode.TreeItemCollapsibleState.None,
    );
    item.id = issue.id;
    item.description = issue.status.replace(/_/g, " ");
    item.contextValue = "issue";
    item.iconPath = new vscode.ThemeIcon(issue.id === this.activeIssueId ? "pass-filled" : "circle-outline");
    item.command = { command: "paperclip.selectIssue", title: "Select Issue", arguments: [issue.id] };
    return item;
  }

  async getChildren(node?: Node): Promise<Node[]> {
    if (node?.kind === "project") return node.issues.map((issue) => ({ kind: "issue", issue }));
    if (node) return [];
    const api = this.session.api;
    if (!api) return [];
    if (this.roots) return this.roots;
    try {
      const [projects, issues] = await Promise.all([
        api.listProjects(),
        api.listIssues({ status: OPEN_STATUSES, limit: 500 }),
      ]);
      this.roots = groupByProject(projects, issues);
      if (this.roots.length === 0) this.roots = [{ kind: "message", text: "No open issues." }];
    } catch (error) {
      this.roots = [{ kind: "message", text: `Could not load issues: ${error instanceof Error ? error.message : String(error)}` }];
    }
    return this.roots;
  }

  findIssue(issueId: string): IssueSummary | null {
    for (const root of this.roots ?? []) {
      if (root.kind !== "project") continue;
      const issue = root.issues.find((candidate) => candidate.id === issueId);
      if (issue) return issue;
    }
    return null;
  }

  allIssues(): IssueSummary[] {
    return (this.roots ?? []).flatMap((root) => (root.kind === "project" ? root.issues : []));
  }

  dispose() {
    this.changed.dispose();
  }
}

function groupByProject(projects: ProjectSummary[], issues: IssueSummary[]): Node[] {
  const names = new Map(projects.filter((project) => !project.archivedAt).map((project) => [project.id, project.name]));
  const groups = new Map<string, IssueSummary[]>();
  for (const issue of issues) {
    const key = issue.projectId && names.has(issue.projectId) ? issue.projectId : NO_PROJECT;
    const bucket = groups.get(key) ?? [];
    bucket.push(issue);
    groups.set(key, bucket);
  }
  return [...groups.entries()]
    .map(([id, bucket]): Node => ({
      kind: "project",
      id,
      name: id === NO_PROJECT ? "No project" : names.get(id)!,
      issues: bucket,
    }))
    .sort((a, b) => (a.kind === "project" && b.kind === "project" ? a.name.localeCompare(b.name) : 0));
}
