import { AiConnectionPoolConnector } from "@/components/ai-connections/AiConnectionPoolConnector";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { isRetiredComposioConnection } from "@paperclipai/shared";
import { findComposioCatalogApp } from "@paperclipai/shared/aggregator-app-catalog";
import { toolsApi } from "@/api/tools";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { ConnectionSetupFlow } from "@/features/connections/ConnectionSetupFlow";
import type { ToolConnectionCredentialSource } from "@paperclipai/shared";
import { useNavigate, useParams, useSearchParams } from "@/lib/router";
import { consumeSkillSourceReturn, skillSourceReturnPath } from "@/lib/skill-source-connect-return";

export { AccessStep, OAuthConnectStateScreen, type OAuthConnectPhase } from "@/features/connections/ConnectionSetupFlow";

/** Full-page host for the same setup used by inline connection requests. */
export function AppsConnect({ byoOnly = false, credentialSource = "paperclip_vault" }: {
  byoOnly?: boolean;
  credentialSource?: ToolConnectionCredentialSource;
} = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { appKey } = useParams<{ appKey?: string }>();
  const source = searchParams.get("source") ?? appKey ?? searchParams.get("appKey");
  const gallery = useQuery({ queryKey: queryKeys.apps.gallery(), queryFn: () => toolsApi.listGallery(), enabled: !!source?.startsWith("ai-router-") });
  const router = gallery.data?.apps.find(app => app.slug === source)?.aiConnectionRouter;
  const toolkit = searchParams.get("targetToolkit");
  const reuseComposio = source === "composio" && Boolean(toolkit && findComposioCatalogApp(toolkit))
    && searchParams.get("new") !== "1" && !searchParams.get("resume") && !searchParams.get("reconnect")
    && !byoOnly && credentialSource === "paperclip_vault";
  const saved = useQuery({ queryKey: queryKeys.tools.connections(),
    queryFn: () => toolsApi.listConnections(), enabled: reuseComposio, retry: false });
  const hasSavedComposio = reuseComposio && saved.data?.connections.some(connection =>
    connection.config?.sourceTemplateKey === "composio" && connection.transport === "mcp_remote"
    && connection.status === "active" && connection.enabled && !isRetiredComposioConnection(connection));
  useEffect(() => {
    if (hasSavedComposio) navigate(`/apps?source=composio&targetToolkit=${encodeURIComponent(toolkit!)}`, { replace: true });
  }, [hasSavedComposio, toolkit, navigate]);
  if (reuseComposio && (saved.isPending || hasSavedComposio)) return <p role="status" className="text-sm text-muted-foreground">Checking saved Composio accounts…</p>;
  if (reuseComposio && saved.isError) return <div className="space-y-3">
    <p role="alert" className="text-sm text-destructive">Couldn’t load your Composio accounts.</p>
    <div className="flex items-center justify-between"><Button variant="ghost" onClick={() => navigate("/apps")}>Cancel</Button><Button onClick={() => void saved.refetch()}>Try again</Button></div>
  </div>;
  const returningToSkills = source === "github" && skillSourceReturnPath();
  function returnToSkills() {
    const path = consumeSkillSourceReturn();
    if (path) navigate(path);
  }
  if (source?.startsWith("ai-router-")) {
    if (gallery.isPending) return <p role="status">Loading connector…</p>;
    if (!router) return <p role="alert">{gallery.error?.message ?? "This connection pool plugin is unavailable. Enable it in Plugins."}</p>;
    return <AiConnectionPoolConnector pluginKey={router.pluginKey} />;
  }
  return <ConnectionSetupFlow byoOnly={byoOnly} credentialSource={credentialSource} host="page"
    onComplete={returningToSkills ? returnToSkills : undefined}
    onCancel={returningToSkills ? returnToSkills : undefined} />;
}
