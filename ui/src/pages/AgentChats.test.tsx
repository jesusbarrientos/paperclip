// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "@paperclipai/shared";
import { recordAgentChatVisit } from "@/lib/recent-agent-chats";
import { AgentChats } from "./AgentChats";

const state = vi.hoisted(() => ({
  userId: "user-a",
  agents: [] as Agent[],
  chats: [] as { id: string; conversationAgentId: string }[],
  chatsFetched: true,
  chatsError: null as Error | null,
  sessionError: null as Error | null,
  navigate: vi.fn(),
}));

vi.mock("@/context/BreadcrumbContext", () => ({ useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }) }));
vi.mock("@/hooks/useAgentChatNavigation", () => ({
  useAgentChatNavigation: () => ({
    userId: state.userId,
    enabled: true,
    loaded: true,
    agents: { data: state.agents, isFetched: true, isPending: false, error: null },
    chats: { data: state.chats, isFetched: state.chatsFetched, isSuccess: state.chatsFetched && !state.chatsError, error: state.chatsError },
    session: { isFetched: !state.sessionError, isPending: false, error: state.sessionError },
  }),
  useOpenAgentChat: () => vi.fn(),
}));
vi.mock("@/lib/router", () => ({
  useNavigate: () => state.navigate,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock("@/components/AgentAvatar", () => ({ AgentAvatar: () => null }));

let root: Root;
let container: HTMLDivElement;
const agent = (id: string) => ({
  id, name: id, urlKey: `${id}-slug`, role: "engineer", status: "idle",
} as Agent);

async function render() {
  await act(async () => root.render(<AgentChats />));
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.userId = "user-a";
  state.agents = [agent("alice"), agent("bob")];
  state.chats = [];
  state.chatsFetched = true;
  state.chatsError = null;
  state.sessionError = null;
  state.navigate.mockReset();
  for (const id of ["alice", "bob", "removed", "retired-id"])
    recordAgentChatVisit("user-a", id, null);
  localStorage.setItem("paperclip.recentAgentChats:user-a", "[]");
  localStorage.setItem("paperclip.recentAgentChats:user-b", "[]");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("Chat landing", () => {
  it("opens the most recently visited agent and replaces the landing history entry", async () => {
    recordAgentChatVisit("user-a", "alice");
    recordAgentChatVisit("user-a", "bob");
    await render();
    expect(state.navigate).toHaveBeenCalledWith("/chats/bob-slug", { replace: true });
    expect(container.textContent).toContain("Opening chat");
  });

  it("skips unavailable saved agents and preserves the user scope", async () => {
    recordAgentChatVisit("user-a", "alice");
    recordAgentChatVisit("user-a", "removed");
    recordAgentChatVisit("user-b", "other-user-agent");
    await render();
    expect(state.navigate).toHaveBeenCalledWith("/chats/alice-slug", { replace: true });
  });

  it("reopens historical chats for agents missing from the active roster", async () => {
    recordAgentChatVisit("user-a", "retired-id");
    state.chats = [{ id: "chat-retired", conversationAgentId: "retired-id" }];
    await render();
    expect(state.navigate).toHaveBeenCalledWith("/chats/retired-id", { replace: true });
  });

  it("waits for history before skipping a recent historical chat", async () => {
    recordAgentChatVisit("user-a", "alice");
    recordAgentChatVisit("user-a", "retired-id");
    state.chatsFetched = false;
    await render();
    expect(state.navigate).not.toHaveBeenCalled();
    state.chatsFetched = true;
    state.chats = [{ id: "chat-retired", conversationAgentId: "retired-id" }];
    await render();
    expect(state.navigate).toHaveBeenCalledWith("/chats/retired-id", { replace: true });
  });

  it("shows the chooser when no saved chat remains available", async () => {
    recordAgentChatVisit("user-a", "removed");
    await render();
    expect(state.navigate).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Who would you like to talk to?");
  });

  it("skips a saved conversation that is no longer accessible even when its agent remains available", async () => {
    recordAgentChatVisit("user-a", "alice");
    recordAgentChatVisit("user-a", "bob", "deleted-chat");
    state.chats = [{ id: "chat-alice", conversationAgentId: "alice" }];
    await render();
    expect(state.navigate).toHaveBeenCalledWith("/chats/alice-slug", { replace: true });
  });

  it("reopens an active agent when history fails", async () => {
    recordAgentChatVisit("user-a", "alice", "chat-alice");
    state.chatsFetched = false;
    state.chatsError = new Error("History unavailable");
    await render();
    expect(state.navigate).toHaveBeenCalledWith("/chats/alice-slug", { replace: true });
  });

  it("reopens a visited empty chat without waiting for history", async () => {
    recordAgentChatVisit("user-a", "alice", null);
    state.chatsFetched = false;
    await render();
    expect(state.navigate).toHaveBeenCalledWith("/chats/alice-slug", { replace: true });
  });

  it("shows a retry state when identity fails instead of waiting for disabled history", async () => {
    recordAgentChatVisit("user-a", "alice");
    state.sessionError = new Error("Session unavailable");
    state.chatsFetched = false;
    await render();
    expect(state.navigate).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Couldn’t load your chats");
  });
});
