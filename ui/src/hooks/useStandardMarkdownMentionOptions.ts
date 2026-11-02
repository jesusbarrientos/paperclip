import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { accessApi } from "../api/access";
import { projectsApi } from "../api/projects";
import { buildMarkdownMentionOptions } from "../lib/company-members";
import { queryKeys } from "../lib/queryKeys";

type MarkdownMentionInputs = Parameters<typeof buildMarkdownMentionOptions>[0];

type StandardMarkdownMentionOptionsArgs = {
  enabled?: boolean;
} & Partial<MarkdownMentionInputs>;

export function useStandardMarkdownMentionOptions(args: StandardMarkdownMentionOptionsArgs = {}) {
  const enabled = args.enabled ?? true;

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(),
    queryFn: () => agentsApi.list(),
    enabled: enabled && args.agents === undefined,
  });
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: () => projectsApi.list(),
    enabled: enabled && args.projects === undefined,
  });
  const usersQuery = useQuery({
    queryKey: queryKeys.access.companyUserDirectory(),
    queryFn: () => accessApi.listUserDirectory(),
    enabled: enabled && args.members === undefined,
  });

  const agents = args.agents ?? agentsQuery.data;
  const projects = args.projects ?? projectsQuery.data;
  const members = args.members ?? usersQuery.data?.users;

  return useMemo(
    () => buildMarkdownMentionOptions({ agents, projects, members }),
    [agents, members, projects],
  );
}
