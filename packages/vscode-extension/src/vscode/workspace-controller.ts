import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as vscode from "vscode";
import {
  computeReadonlyGlobs,
  createWorkspaceFile,
  mergeReadonlyInclude,
  parseWorkspaceFile,
  planFolderSwitch,
  READONLY_SETTING,
  resolveContextFolders,
  samePath,
  serializeWorkspaceFile,
  type DirectoryReader,
} from "../core/workspace-file.js";

const MANAGED_GLOBS_KEY = "paperclip.managedReadonlyGlobs";

const nodeReader: DirectoryReader = {
  exists: (target) => fs.existsSync(target),
  isDirectory: (target) => {
    try {
      return fs.statSync(target).isDirectory();
    } catch {
      return false;
    }
  },
  list: (target) => fs.readdirSync(target),
};

export function managedWorkspaceDir(paperclipHome: string) {
  return path.join(paperclipHome, "vscode");
}

/**
 * Switching issues rewrites only folders 1..n of a `.code-workspace` whose
 * folder 0 is a fixed control folder. Replacing folder 0 restarts the
 * extension host, which would drop the live session mid-switch.
 */
export class WorkspaceController {
  constructor(
    private readonly state: vscode.Memento,
    private readonly paperclipHome: string,
  ) {}

  get controlFolder() {
    return path.join(managedWorkspaceDir(this.paperclipHome), "control");
  }

  get workspaceFilePath() {
    return path.join(managedWorkspaceDir(this.paperclipHome), "paperclip.code-workspace");
  }

  isManagedWorkspace() {
    const file = vscode.workspace.workspaceFile;
    return Boolean(file && file.scheme === "file" && samePath(file.fsPath, this.workspaceFilePath));
  }

  async openManagedWorkspace() {
    fs.mkdirSync(this.controlFolder, { recursive: true });
    const readme = path.join(this.controlFolder, "README.md");
    if (!fs.existsSync(readme)) {
      fs.writeFileSync(
        readme,
        "# Paperclip\n\nThis folder anchors the Paperclip workspace. The other folders change with the selected issue.\n",
      );
    }
    if (!fs.existsSync(this.workspaceFilePath)) {
      fs.writeFileSync(this.workspaceFilePath, serializeWorkspaceFile(createWorkspaceFile(this.controlFolder)));
    } else {
      parseWorkspaceFile(fs.readFileSync(this.workspaceFilePath, "utf8"));
    }
    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(this.workspaceFilePath), {
      forceNewWindow: false,
    });
  }

  contextFolders(remotePath: string | null) {
    return resolveContextFolders(remotePath, nodeReader);
  }

  /** A failed save stops the switch: swapping folders under a dirty editor would leave its changes on the previous issue. */
  async showFolders(folders: string[]): Promise<{ switched: boolean; reason?: string }> {
    if (!this.isManagedWorkspace()) return { switched: false, reason: "not_managed" };
    const saved = await vscode.workspace.saveAll(false);
    if (!saved) return { switched: false, reason: "unsaved" };
    const current = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
    const plan = planFolderSwitch(
      current,
      folders.map((folder) => ({ path: folder, name: path.basename(folder) })),
    );
    if (!plan) return { switched: true };
    const ok = vscode.workspace.updateWorkspaceFolders(
      plan.start,
      plan.deleteCount,
      ...plan.add.map((entry) => ({ uri: vscode.Uri.file(entry.path), name: entry.name })),
    );
    return ok ? { switched: true } : { switched: false, reason: "rejected" };
  }

  async setReadonly(folders: string[]) {
    if (!vscode.workspace.workspaceFile) return;
    const configuration = vscode.workspace.getConfiguration();
    const previous = this.state.get<string[]>(MANAGED_GLOBS_KEY, []);
    const next = computeReadonlyGlobs(folders, os.platform());
    if (previous.length === next.length && previous.every((glob, index) => glob === next[index])) return;
    const current = configuration.inspect<Record<string, boolean>>(READONLY_SETTING)?.workspaceValue;
    await configuration.update(
      READONLY_SETTING,
      mergeReadonlyInclude(current, previous, next),
      vscode.ConfigurationTarget.Workspace,
    );
    await this.state.update(MANAGED_GLOBS_KEY, next);
  }
}
