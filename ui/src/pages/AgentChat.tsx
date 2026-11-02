import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { agentChatsApi } from "@/api/agentChats";
import { agentsApi } from "@/api/agents";
import { authApi } from "@/api/auth";
import { useAgentChatEnabled } from "@/hooks/useAgentChatEnabled";
import { recordAgentChatVisit } from "@/lib/recent-agent-chats";
import { queryKeys } from "@/lib/queryKeys";
import { useParams } from "@/lib/router";
import { agentRouteRef } from "@/lib/utils";
import { TaskDetailSurface } from "./IssueDetail";
import { isUuidLike, type Issue } from "@paperclipai/shared";

export function AgentChat() {
  const { agentRef = "" } = useParams<{ agentRef: string }>();
  const { enabled, loaded } = useAgentChatEnabled();
  const client = useQueryClient();
  const agents = useQuery({
    queryKey: queryKeys.agents.list(),
    queryFn: () => agentsApi.list(),
  });
  const session = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const userId =
    session.data?.user?.id ?? session.data?.session?.userId ?? null;
  const rosterAgent = agents.data?.find(
    (item) => item.id === agentRef || agentRouteRef(item) === agentRef,
  );
  const historyAgent = useQuery({
    queryKey: queryKeys.agents.detail(agentRef),
    queryFn: () => agentsApi.get(agentRef),
    enabled: enabled && agents.isSuccess && !rosterAgent && isUuidLike(agentRef),
  });
  const agent = rosterAgent ?? historyAgent.data;
  const chatKey = queryKeys.agentChats.detail(userId, agent?.id);
  const chat = useQuery({
    queryKey: chatKey,
    queryFn: () => agentChatsApi.get(agent!.id),
    enabled: enabled && !!agent && session.isFetched,
  });
  const creating = useRef<Promise<Issue> | null>(null);
  useEffect(() => {
    creating.current = null;
  }, [userId, agent?.id]);
  useEffect(() => {
    if (enabled && agent && session.isSuccess && chat.isSuccess)
      recordAgentChatVisit(userId, agent.id, chat.data?.id ?? null);
  }, [enabled, agent?.id, userId, session.isSuccess, chat.isSuccess, chat.data?.id]);
  const ensureIssue = useCallback(async () => {
    if (!agent) throw new Error("Agent not found");
    if (chat.data) return chat.data;
    const promise = (creating.current ??= agentChatsApi.ensure(
      agent.id,
    ));
    try {
      const issue = await promise;
      client.setQueryData(queryKeys.issues.detail(issue.id), issue);
      client.setQueryData(chatKey, issue);
      void client.invalidateQueries({ queryKey: queryKeys.agentChats.list(userId) });
      return issue;
    } catch (error) {
      creating.current = null;
      throw error;
    }
  }, [agent, chat.data, client, userId]);
  if (!loaded || agents.isPending || session.isPending || historyAgent.isFetching && !agent)
    return (
      <p className="text-sm text-muted-foreground">Loading conversation…</p>
    );
  if (!enabled && !chat.data)
    return (
      <p className="text-sm text-muted-foreground">
        Agent Chat is disabled. Enable it in Experimental settings. Existing
        history remains available through task links.
      </p>
    );
  if (agents.error || chat.error || !rosterAgent && historyAgent.error)
    return (
      <p className="text-sm text-destructive">
        {(agents.error ?? chat.error ?? historyAgent.error)?.message}
      </p>
    );
  if (!agent)
    return <p className="text-sm text-destructive">Agent not found.</p>;
  if (chat.isPending)
    return (
      <p className="text-sm text-muted-foreground">Loading conversation…</p>
    );
  return (
    <TaskDetailSurface
      key={`${agent.id}:${userId}`}
      conversation={{ agent, issue: chat.data ?? null, ensureIssue }}
    />
  );
}
