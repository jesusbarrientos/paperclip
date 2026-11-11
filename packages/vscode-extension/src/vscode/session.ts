import os from "node:os";
import * as vscode from "vscode";
import { ApiError, normalizeServerUrl, PaperclipApi } from "../core/api-client.js";
import { createCliAuthChallenge, SignInError, waitForChallengeApproval } from "../core/auth.js";

function secretKey(serverUrl: string) {
  return `paperclip.boardToken:${normalizeServerUrl(serverUrl)}`;
}

export function configuredServerUrl() {
  return vscode.workspace.getConfiguration("paperclip").get<string>("serverUrl", "http://localhost:3100");
}

/** Board API key per server URL, kept in SecretStorage so it never lands in settings or workspace files. */
export class PaperclipSession implements vscode.Disposable {
  private apiInstance: PaperclipApi | null = null;
  private userLabel: string | null = null;
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changed.event;

  constructor(private readonly secrets: vscode.SecretStorage) {}

  get api() {
    return this.apiInstance;
  }

  get user() {
    return this.userLabel;
  }

  get serverUrl() {
    return normalizeServerUrl(configuredServerUrl());
  }

  async restore() {
    const token = await this.secrets.get(secretKey(this.serverUrl));
    if (!token) {
      await this.setApi(null);
      return;
    }
    const api = new PaperclipApi({ serverUrl: this.serverUrl, token });
    try {
      const me = await api.me();
      this.userLabel = me.user?.name ?? me.user?.email ?? me.userId;
      await this.setApi(api);
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized) {
        await this.secrets.delete(secretKey(this.serverUrl));
        await this.setApi(null);
        return;
      }
      // Server unreachable: keep the token and let the views show the error.
      this.userLabel = null;
      await this.setApi(api);
    }
  }

  async signIn() {
    const serverUrl = this.serverUrl;
    const challenge = await createCliAuthChallenge(
      (input, init) => fetch(input, init),
      serverUrl,
      `VS Code on ${os.hostname()}`,
    );
    await vscode.env.openExternal(vscode.Uri.parse(challenge.resolvedApprovalUrl));
    const token = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Approve the Paperclip sign in in your browser…",
        cancellable: true,
      },
      (_progress, cancellation) => {
        const controller = new AbortController();
        cancellation.onCancellationRequested(() => controller.abort());
        return waitForChallengeApproval({
          fetch: (input, init) => fetch(input, init),
          serverUrl,
          challenge,
          signal: controller.signal,
        });
      },
    );
    await this.secrets.store(secretKey(serverUrl), token);
    await this.restore();
  }

  async signOut() {
    const api = this.apiInstance;
    if (api) await api.revokeCurrentKey().catch(() => undefined);
    await this.secrets.delete(secretKey(this.serverUrl));
    this.userLabel = null;
    await this.setApi(null);
  }

  private async setApi(api: PaperclipApi | null) {
    this.apiInstance = api;
    await vscode.commands.executeCommand("setContext", "paperclip.signedIn", api !== null);
    this.changed.fire();
  }

  dispose() {
    this.changed.dispose();
  }
}

export function describeSignInError(error: unknown) {
  if (error instanceof SignInError && error.reason === "aborted") return null;
  return error instanceof Error ? error.message : String(error);
}
