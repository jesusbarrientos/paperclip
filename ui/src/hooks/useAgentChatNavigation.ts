import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Agent, Issue } from "@paperclipai/shared";
import { agentsApi } from "@/api/agents";
import { agentChatsApi } from "@/api/agentChats";
import { authApi } from "@/api/auth";
import { useSidebar } from "@/context/SidebarContext";
import { queryKeys } from "@/lib/queryKeys";
import { useNavigate } from "@/lib/router";
import { agentRouteRef } from "@/lib/utils";
import { useAgentChatEnabled } from "./useAgentChatEnabled";

export function useAgentChatNavigation() {
  const { enabled, loaded } = useAgentChatEnabled();
  const session = useQuery({ queryKey: queryKeys.auth.session, queryFn: () => authApi.getSession() });
  const userId = session.data?.user?.id ?? session.data?.session?.userId ?? null;
  const agents = useQuery({
    queryKey: queryKeys.agents.list(), queryFn: () => agentsApi.list(),
    enabled: enabled,
  });
  const chats = useQuery({
    queryKey: queryKeys.agentChats.list(userId), queryFn: () => agentChatsApi.list(),
    enabled: enabled && session.isSuccess,
  });
  return { userId, enabled, loaded, agents, chats, session };
}

/** Explicitly adding a chat uses the existing atomic, one-per-agent resolver. */
export function useOpenAgentChat(userId: string | null) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const { isMobile, setSidebarOpen } = useSidebar();
  const scope = useRef({ userId, mounted: true });
  useEffect(() => {
    const current = { userId, mounted: true };
    scope.current = current;
    return () => { current.mounted = false; };
  }, [userId]);
  return useCallback(async (agent: Agent, signal?: AbortSignal) => {
    const current = scope.current;
    const chat = await agentChatsApi.ensure(agent.id);
    client.setQueryData(queryKeys.agentChats.detail(userId, agent.id), chat);
    client.setQueryData(queryKeys.issues.detail(chat.id), chat);
    client.setQueryData<Issue[]>(queryKeys.agentChats.list(userId), previous =>
      [chat, ...(previous ?? []).filter(item => item.id !== chat.id)]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() || b.id.localeCompare(a.id)));
    if (!current.mounted || scope.current !== current || signal?.aborted) return;
    navigate(`/chats/${encodeURIComponent(agentRouteRef(agent))}`);
    if (isMobile) setSidebarOpen(false);
  }, [client, userId, navigate, isMobile, setSidebarOpen]);
}
