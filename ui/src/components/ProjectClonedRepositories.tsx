import { useQuery } from "@tanstack/react-query";
import type { ProjectClonedRepository } from "@paperclipai/shared";
import { FolderGit2, RefreshCw } from "lucide-react";
import { projectsApi } from "@/api/projects";
import { queryKeys } from "@/lib/queryKeys";
import { timeAgo } from "@/lib/timeAgo";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

function statusBadge(repo: ProjectClonedRepository) {
  if (repo.status === "missing") return <Badge variant="outline">Not cloned</Badge>;
  if (repo.status === "not_git") return <Badge variant="destructive">Not a git repo</Badge>;
  if (repo.dirty) return <Badge variant="secondary">{repo.changedFileCount} uncommitted {repo.changedFileCount === 1 ? "change" : "changes"}</Badge>;
  return <Badge variant="outline">Clean</Badge>;
}

/** Live on-disk state of every repository checkout belonging to the project. */
export function ProjectClonedRepositories({ projectId, companyId }: { projectId: string; companyId: string }) {
  const query = useQuery({
    queryKey: queryKeys.projects.clonedRepositories(projectId),
    queryFn: () => projectsApi.listClonedRepositories(projectId, companyId),
  });
  return <div className="flex min-w-0 flex-col gap-2" aria-label="Cloned repositories">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">Cloned repositories</span>
      <Button type="button" variant="ghost" size="sm" aria-label="Refresh cloned repositories" disabled={query.isFetching} onClick={() => void query.refetch()}>
        <RefreshCw className="size-4" />
      </Button>
    </div>
    {query.isLoading && <p className="text-sm text-muted-foreground">Inspecting checkouts…</p>}
    {query.isError && <p role="alert" className="text-sm text-destructive">{query.error.message}</p>}
    {query.data && query.data.length === 0 && <p className="text-sm text-muted-foreground">No repositories configured for this project.</p>}
    {query.data?.map((repo) => <div key={repo.workspaceId} className="flex min-w-0 items-start gap-3 rounded-md border border-border px-3 py-2">
      <FolderGit2 className="mt-1 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 break-all text-sm font-medium">{repo.workspaceName}</span>
          {repo.branch && <Badge variant="outline">{repo.branch}</Badge>}
          {statusBadge(repo)}
        </div>
        <span className="break-all font-mono text-xs text-muted-foreground" title={repo.location === "managed" ? "Managed checkout" : "Configured path"}>{repo.path}</span>
        {repo.lastCommit && <span className="min-w-0 truncate text-xs text-muted-foreground" title={repo.lastCommit.subject}>
          <span className="font-mono">{repo.lastCommit.sha.slice(0, 7)}</span> {repo.lastCommit.subject} · {repo.lastCommit.authorName} · {timeAgo(repo.lastCommit.committedAt)}
        </span>}
        {repo.error && <span role="alert" className="text-xs text-destructive">{repo.error}</span>}
      </div>
    </div>)}
  </div>;
}
