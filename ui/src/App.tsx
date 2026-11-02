import { lazy, Suspense, type ReactNode } from "react";
import type { ToolConnectionCredentialSource } from "@paperclipai/shared";
import { Navigate, Route, Routes, useLocation, useParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { Layout } from "./components/Layout";
import { Layout as ProductionLayout } from "./components/Layout.production";
import { ConferenceRoomChatGate } from "./components/ConferenceRoomChatGate";
import { TaskChatLab } from "./pages/TaskChatLab";
import { PipelinesExperimentalGate } from "./components/PipelinesExperimentalGate";
import { CasesExperimentalGate } from "./components/CasesExperimentalGate";
import { StatusCardsExperimentalGate } from "./components/StatusCardsExperimentalGate";
import { CloudManagedPageGate } from "./components/CloudManagedPageGate";
import { HiddenSettingsPageGate } from "./components/HiddenSettingsPageGate";
import { IsolatedWorkspacesRouteGate } from "./components/IsolatedWorkspacesRouteGate";
import { useHiddenSettings } from "./hooks/useHiddenSettings";
import { Cases } from "./pages/Cases";
import { CaseDetail } from "./pages/CaseDetail";
import { OnboardingWizardVariant } from "./components/OnboardingWizardVariant";
import { CloudAccessGate } from "./components/CloudAccessGate";
import { PaperclipLoading } from "./components/AnimatedPaperclipIcon";
import { Dashboard } from "./pages/Dashboard";
import { DashboardLive } from "./pages/DashboardLive";
import { Timeline } from "./pages/Timeline";
import { AGENT_FILTER_TABS, Agents } from "./pages/Agents";
import { AgentDetail } from "./pages/AgentDetail";
import { Projects } from "./pages/Projects";
import { ProjectDetail } from "./pages/ProjectDetail";
import { ProjectWorkspaceDetail } from "./pages/ProjectWorkspaceDetail";
import { Workspaces } from "./pages/Workspaces";
import { Issues } from "./pages/Issues";
import { Search } from "./pages/Search";
import { IssueDetail } from "./pages/IssueDetail";
import { AgentChats } from "./pages/AgentChats";
import { AgentChat } from "./pages/AgentChat";
import { IssueChatLongThreadPerf } from "./pages/IssueChatLongThreadPerf";
import { Routines } from "./pages/Routines";
import { Learnings, PipelineItemDetail, PipelineItemLegacyRedirect, Pipelines, ReviewQueue } from "./pages/Pipelines";
import { PipelineSettings } from "./pages/PipelineSettings";
import { StatusCards } from "./pages/StatusCards";
import { RoutineDetail } from "./pages/RoutineDetail";
import { UserProfile } from "./pages/UserProfile";
import { ExecutionWorkspaceDetail } from "./pages/ExecutionWorkspaceDetail";
import { Goals } from "./pages/Goals";
import { Artifacts } from "./pages/Artifacts";
import { GoalDetail } from "./pages/GoalDetail";
import { Approvals } from "./pages/Approvals";
import { ApprovalDetail } from "./pages/ApprovalDetail";
import { CompanyActivity } from "./pages/audit/CompanyActivity";
import { AuditHub } from "./pages/audit/AuditHub";
import { Inbox } from "./pages/Inbox";
import { useCombinedInboxTasksEnabled } from "./hooks/useCombinedInboxTasksEnabled";
import { WhatNeedsMe } from "./pages/WhatNeedsMe";
import { DecisionQueuePage } from "./pages/DecisionQueuePage";
import { BoardChat } from "./pages/BoardChat";
import { OrganizationSettings } from "./pages/OrganizationSettings";
import { OrganizationEnvironments } from "./pages/OrganizationEnvironments";
import { BootstrapSetupUxLab } from "./pages/BootstrapSetupUxLab";
import { ResponsibleUserDenialUxLab } from "./pages/ResponsibleUserDenialUxLab";
import { CrossIssueCollaborationUxLab } from "./pages/CrossIssueCollaborationUxLab";
import { OrganizationSettingsPluginPage } from "./pages/OrganizationSettingsPluginPage";
import { OrganizationAccess, OrganizationAccessLegacyRoute } from "./pages/OrganizationAccess";
import { AdvancedToolsRoute } from "./pages/tools/AdvancedToolsRoute";
import { ProfileWizardRoute } from "./pages/tools/profiles/ProfileWizardRoute";
import { ProfileDetailRoute } from "./pages/tools/profiles/ProfileDetailRoute";
import { Browse } from "./pages/apps/Browse";
import { AppsConnect } from "./pages/apps/AppsConnect";
import { ChatEndpointSetup } from "./pages/apps/chat/ChatEndpointSetup";
import { ChatEndpointDetail } from "./pages/apps/chat/ChatEndpointDetail";
import { ChatIdentityConfirm } from "./pages/apps/chat/ChatIdentityConfirm";
import { ChatConnectorsExperimentalGate } from "./components/ChatConnectorsExperimentalGate";
import { useChatConnectorsEnabled } from "./hooks/useChatConnectorsEnabled";
import { canEnterAppsConnect } from "./pages/apps/app-connect-policy";
import { AppsReview } from "./pages/apps/AppsReview";
import { AppDetail } from "./pages/apps/AppDetail";
import { AppNotConnected } from "./pages/apps/AppNotConnected";
import { PaperclipCloudOAuthHandoffPage } from "./pages/apps/PaperclipCloudOAuthHandoff";
import { GatewaysList } from "./pages/apps/gateways/GatewaysList";
import { GatewayDetail } from "./pages/apps/gateways/GatewayDetail";
import { OrganizationSkills } from "./pages/OrganizationSkills";
import { SkillSources } from "./pages/SkillSources";
import { SkillStudio } from "./pages/SkillStudio";
import { Secrets } from "./pages/Secrets";
import { CompanyImport } from "./pages/CompanyImport";
import { DesignGuide } from "./pages/DesignGuide";
import { InstanceExperimentalSettings } from "./pages/InstanceExperimentalSettings";
import { InstanceAccess } from "./pages/InstanceAccess";
import { ProfileSettings } from "./pages/ProfileSettings";
import { PluginManager } from "./pages/PluginManager";
import { PluginSettings } from "./pages/PluginSettings";
import { AdapterManager } from "./pages/AdapterManager";
import { PluginPage } from "./pages/PluginPage";
import { NewAgent } from "./pages/NewAgent";
import { AuthPage } from "./pages/Auth";
import { BoardClaimPage } from "./pages/BoardClaim";
import { AssistantConnection } from "./pages/apps/AssistantConnection";
import { McpConnectPage, McpDevicePage, AssistantConnectionsPage } from "./pages/McpConnect";
import { CliAuthPage } from "./pages/CliAuth";
import { InviteLandingPage } from "./pages/InviteLanding";
import { JoinRequestQueue } from "./pages/JoinRequestQueue";
import { NotFoundPage } from "./pages/NotFound";
import { useOrganization } from "./context/OrganizationContext";
import { useDialogActions, useDialogState } from "./context/DialogContext";
import { loadLastInboxTab } from "./lib/inbox";
import { TASK_VIEW_PARAM, taskViewForInboxTab, type TaskViewKey } from "./lib/task-views";
import {
  isOnboardingPath,
  isOnboardingWizardActive,
  onboardingStepForCompany,
} from "./lib/onboarding-route";
import { filterHiddenInstanceSettingsPath, normalizeRememberedInstanceSettingsPath } from "./lib/instance-settings";
import { useCloudInstance } from "./hooks/useCloudInstance";
import { useStreamlinedUiEnabled } from "./hooks/useStreamlinedUiEnabled";
import { cloudStackCreateUrl } from "./lib/cloudLinks";
import { navigateTopLevel } from "@/lib/browserNavigation";

const CompanyExport = lazy(() =>
  import("./pages/CompanyExport").then((module) => ({ default: module.CompanyExport })),
);

const ProductionAgents = lazy(() =>
  import("./pages/Agents.production").then((module) => ({ default: module.Agents })),
);
const ProductionRoutines = lazy(() =>
  import("./pages/Routines.production").then((module) => ({ default: module.Routines })),
);
const ProductionRoutineDetail = lazy(() =>
  import("./pages/RoutineDetail.production").then((module) => ({ default: module.RoutineDetail })),
);
const ProductionCompanySkills = lazy(() =>
  import("./pages/OrganizationSkills.production").then((module) => ({ default: module.OrganizationSkills })),
);
const ProductionCompanyActivity = lazy(() =>
  import("./pages/audit/CompanyActivity.production").then((module) => ({ default: module.CompanyActivity })),
);
const ProductionCosts = lazy(() =>
  import("./pages/Costs.production").then((module) => ({ default: module.Costs })),
);
const ProductionOrgChart = lazy(() =>
  import("./pages/OrgChart.production").then((module) => ({ default: module.OrgChart })),
);

function ProductionSurface({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PaperclipLoading />}>{children}</Suspense>;
}

function boardRoutes(streamlinedUiEnabled: boolean, combinedInboxTasksEnabled: boolean) {
  // Combined Inbox + Task List (PAP-670) only exists in the streamlined shell.
  const mergedTasks = streamlinedUiEnabled && combinedInboxTasksEnabled;
  return (
    <>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="dashboard/live" element={<DashboardLive />} />
      <Route
        path="timeline"
        element={streamlinedUiEnabled ? <AuditCompatibilityRedirect to="/activity/timeline" /> : <Timeline />}
      />
      <Route path="onboarding" element={<OnboardingRoutePage />} />
      <Route path="organization/settings" element={<OrganizationSettings />} />
      <Route path="organization/settings/environments" element={<Navigate to="/organization/settings/instance/environments" replace />} />
      <Route path="organization/settings/cloud-upstream" element={<Navigate to="/organization/export" replace />} />
      <Route element={<HiddenSettingsPageGate pageKey="company.members" />}>
        <Route path="organization/settings/members" element={<OrganizationAccess />} />
        <Route path="organization/settings/access" element={<OrganizationAccessLegacyRoute />} />
      </Route>
      {/* Invites moved into the Members page; the old URL redirects (and stays
          gated so a hidden Invites surface never round-trips through it). */}
      <Route element={<HiddenSettingsPageGate pageKey="company.invites" />}>
        <Route
          path="organization/settings/invites"
          element={<Navigate to="/organization/settings/members?tab=invites" replace />}
        />
      </Route>
      <Route element={<HiddenSettingsPageGate pageKey="company.export" />}>
        <Route
          path="organization/export/*"
          element={(
            <Suspense fallback={<PaperclipLoading />}>
              <CompanyExport />
            </Suspense>
          )}
        />
      </Route>
      <Route element={<CloudManagedPageGate />}>
        <Route element={<HiddenSettingsPageGate pageKey="company.import" />}>
          <Route path="organization/import" element={<CompanyImport />} />
        </Route>
      </Route>
      <Route element={<HiddenSettingsPageGate pageKey="company.secrets" />}>
        <Route path="organization/settings/secrets" element={<Secrets />} />
      </Route>
      <Route path="organization/settings/tools" element={<LegacyToolsSettingsRedirect />} />
      <Route path="organization/settings/tools/:tab" element={<LegacyToolsSettingsRedirect />} />
      <Route path="tools" element={<LegacyToolsRedirect />} />
      <Route path="tools/:tab" element={<LegacyToolsRedirect />} />
      <Route path="apps" element={<Browse />} />
      <Route path="apps/assistant-connection" element={<AssistantConnection />} />
      <Route path="apps/browse" element={<Navigate to="/apps" replace />} />
      <Route path="apps/connections" element={<Navigate to="/apps" replace />} />
      <Route path="apps/byo" element={<AppsConnect byoOnly />} />
      <Route
        path="apps/vercel-connect"
        element={<AppsConnectEntryRoute credentialSource="vercel_connect" />}
      />
      <Route path="apps/connect" element={<AppsConnectEntryRoute />} />
      <Route path="apps/chat/connect" element={
        <ChatConnectorsExperimentalGate><ChatEndpointSetup /></ChatConnectorsExperimentalGate>
      } />
      <Route path="apps/chat/:endpointId" element={
        <ChatConnectorsExperimentalGate><Navigate to="settings" replace /></ChatConnectorsExperimentalGate>
      } />
      <Route path="apps/chat/:endpointId/:tab" element={
        <ChatConnectorsExperimentalGate><ChatEndpointDetail /></ChatConnectorsExperimentalGate>
      } />
      <Route path="apps/connect/:appKey" element={<Navigate to="/apps" replace />} />
      <Route path="apps/connect/:appKey/:stage" element={<Navigate to="/apps" replace />} />
      <Route path="apps/review" element={<AppsReview />} />
      {/* Connector health is inline on the Apps landing page; keep legacy links working. */}
      <Route path="apps/attention" element={<Navigate to="/apps" replace />} />
      <Route path="apps/gateways" element={<GatewaysList />} />
      <Route path="apps/gateways/:gatewayId" element={<Navigate to="overview" replace />} />
      <Route path="apps/gateways/:gatewayId/:tab" element={<GatewayDetail />} />
      <Route path="apps/advanced" element={<AdvancedToolsRoute />} />
      <Route path="apps/advanced/gateways" element={<GatewaysList />} />
      <Route path="apps/advanced/profiles/new" element={<ProfileWizardRoute mode="new" />} />
      <Route path="apps/advanced/profiles/:profileId/edit" element={<ProfileWizardRoute mode="edit" />} />
      <Route path="apps/advanced/profiles/:profileId" element={<ProfileDetailRoute />} />
      <Route path="apps/advanced/audit" element={<Navigate to="/apps" replace />} />
      <Route path="apps/advanced/run-your-own" element={<Navigate to="/apps" replace />} />
      <Route path="apps/advanced/:tab" element={<AdvancedToolsRoute />} />
      <Route path="apps/app/:applicationId" element={<AppNotConnected />} />
      <Route path="apps/app/:applicationId/:tab" element={<AppNotConnected />} />
      <Route path="apps/:connectionId" element={<Navigate to="permissions" replace />} />
      <Route path="apps/:connectionId/:tab" element={<AppDetail />} />
      <Route path="organization/settings/instance" element={<Navigate to="/organization/settings" replace />} />
      <Route element={<HiddenSettingsPageGate pageKey="instance.profile" />}>
        <Route path="organization/settings/instance/profile" element={<ProfileSettings />} />
      </Route>
      <Route path="organization/settings/instance/general" element={<Navigate to="/organization/settings" replace />} />
      <Route path="organization/settings/instance/heartbeats" element={<Navigate to="/organization/settings" replace />} />
      <Route element={<HiddenSettingsPageGate pageKey="instance.environments" />}>
        <Route path="organization/settings/instance/environments" element={<OrganizationEnvironments />} />
        <Route path="organization/settings/instance/environments/new" element={<OrganizationEnvironments mode="create" />} />
        <Route path="organization/settings/instance/environments/:environmentId/edit" element={<OrganizationEnvironments mode="edit" />} />
      </Route>
      <Route element={<HiddenSettingsPageGate pageKey="instance.access" />}>
        <Route path="organization/settings/instance/access" element={<InstanceAccess />} />
      </Route>
      <Route element={<HiddenSettingsPageGate pageKey="instance.experimental" />}>
        <Route path="organization/settings/instance/experimental" element={<InstanceExperimentalSettings />} />
      </Route>
      <Route element={<HiddenSettingsPageGate pageKey="instance.plugins" />}>
        <Route path="organization/settings/instance/plugins" element={<PluginManager />} />
        <Route path="organization/settings/instance/plugins/:pluginId" element={<PluginSettings />} />
      </Route>
      <Route element={<HiddenSettingsPageGate pageKey="instance.adapters" />}>
        <Route path="organization/settings/instance/adapters" element={<AdapterManager />} />
      </Route>
      <Route path="organization/settings/:settingsRoutePath/*" element={<OrganizationSettingsPluginPage />} />
      <Route path="skills/sources" element={<SkillSources />} />
      <Route path="skills/sources/:sourceId" element={<SkillSources />} />
      <Route path="skills/studio" element={<SkillStudio />} />
      <Route path="skills/studio/new" element={<SkillStudio />} />
      <Route path="skills/studio/:skillId" element={<SkillStudio />} />
      <Route path="skills/:skillId/studio" element={<LegacySkillStudioRedirect />} />
      <Route
        path="skills/*"
        element={streamlinedUiEnabled ? <OrganizationSkills /> : <ProductionSurface><ProductionCompanySkills /></ProductionSurface>}
      />
      <Route path="settings" element={<LegacySettingsRedirect />} />
      <Route path="settings/*" element={<LegacySettingsRedirect />} />
      <Route path="instance" element={<LegacySettingsRedirect />} />
      <Route path="instance/settings" element={<LegacySettingsRedirect />} />
      <Route path="instance/settings/*" element={<LegacySettingsRedirect />} />
      <Route path="company/*" element={<LegacyCompanyPathRedirect />} />
      <Route path="plugins/:pluginId" element={<PluginPage />} />
      <Route
        path="org"
        element={streamlinedUiEnabled ? <Navigate to="/agents/all" replace /> : <ProductionSurface><ProductionOrgChart /></ProductionSurface>}
      />
      <Route path="agents" element={<Navigate to="/agents/all" replace />} />
      {AGENT_FILTER_TABS.map((tab) => (
        <Route
          key={tab}
          path={`agents/${tab}`}
          element={streamlinedUiEnabled ? <Agents /> : <ProductionSurface><ProductionAgents /></ProductionSurface>}
        />
      ))}
      <Route path="agents/new" element={<NewAgent />} />
      <Route path="agents/:agentId" element={<AgentDetail />} />
      <Route path="agents/:agentId/:tab" element={<AgentDetail />} />
      <Route path="agents/:agentId/runs/:runId" element={<AgentDetail />} />
      <Route path="projects" element={<Projects />} />
      <Route path="projects/:projectId" element={<ProjectDetail />} />
      <Route path="projects/:projectId/overview" element={<ProjectDetail />} />
      <Route path="projects/:projectId/issues" element={<ProjectDetail />} />
      <Route path="projects/:projectId/issues/:filter" element={<ProjectDetail />} />
      <Route element={<IsolatedWorkspacesRouteGate />}>
        <Route path="projects/:projectId/workspaces/:workspaceId" element={<ProjectWorkspaceDetail />} />
      </Route>
      <Route path="projects/:projectId/workspaces" element={<ProjectDetail />} />
      <Route path="projects/:projectId/configuration" element={<ProjectDetail />} />
      <Route path="projects/:projectId/budget" element={<ProjectDetail />} />
      <Route element={<IsolatedWorkspacesRouteGate />}>
        <Route path="workspaces" element={<Workspaces />} />
      </Route>
      <Route path="issues" element={<Issues />} />
      <Route path="tasks" element={<Navigate to="/issues" replace />} />
      <Route path="search" element={<Search />} />
      {mergedTasks ? (
        <>
          {/* Combined Inbox + Task List: the status presets are real views, not aliases of /issues. */}
          <Route path="issues/all" element={<TaskViewRedirect view="all" />} />
          <Route path="issues/active" element={<TaskViewRedirect view="active" />} />
          <Route path="issues/backlog" element={<TaskViewRedirect view="backlog" />} />
          <Route path="issues/done" element={<TaskViewRedirect view="done" />} />
          <Route path="issues/recent" element={<TaskViewRedirect view="recent" />} />
        </>
      ) : (
        <>
          <Route path="issues/all" element={<Navigate to="/issues" replace />} />
          <Route path="issues/active" element={<Navigate to="/issues" replace />} />
          <Route path="issues/backlog" element={<Navigate to="/issues" replace />} />
          <Route path="issues/done" element={<Navigate to="/issues" replace />} />
          <Route path="issues/recent" element={<Navigate to="/issues" replace />} />
        </>
      )}
      <Route path="chats" element={<AgentChats />} />
      <Route path="chats/:agentRef" element={<AgentChat />} />
      <Route path="issues/:issueId" element={<IssueDetail />} />
      {import.meta.env.DEV ? (
        <Route path="tests/perf/long-thread" element={<IssueChatLongThreadPerf />} />
      ) : null}
      <Route path="routines" element={streamlinedUiEnabled ? <Routines /> : <ProductionSurface><ProductionRoutines /></ProductionSurface>} />
      <Route
        path="cases"
        element={<CasesExperimentalGate><Cases /></CasesExperimentalGate>}
      />
      <Route
        path="cases/:caseIdentifier"
        element={<CasesExperimentalGate><CaseDetail /></CasesExperimentalGate>}
      />
      <Route
        path="status"
        element={<StatusCardsExperimentalGate><StatusCards /></StatusCardsExperimentalGate>}
      />
      <Route
        path="status/:cardId"
        element={<StatusCardsExperimentalGate><StatusCards /></StatusCardsExperimentalGate>}
      />
      {/* Back-compat: the board lived at /status-cards before PAP-15223. */}
      <Route path="status-cards" element={<StatusCardsLegacyRedirect />} />
      <Route path="status-cards/:cardId" element={<StatusCardsLegacyRedirect />} />
      <Route
        path="review-queue"
        element={<PipelinesExperimentalGate><ReviewQueue /></PipelinesExperimentalGate>}
      />
      <Route
        path="learnings"
        element={<PipelinesExperimentalGate><Learnings /></PipelinesExperimentalGate>}
      />
      <Route
        path="pipelines"
        element={<PipelinesExperimentalGate><Pipelines /></PipelinesExperimentalGate>}
      />
      <Route
        path="pipelines/:pipelineId"
        element={<PipelinesExperimentalGate><Pipelines /></PipelinesExperimentalGate>}
      />
      <Route
        path="pipelines/:pipelineId/add"
        element={<PipelinesExperimentalGate><Pipelines /></PipelinesExperimentalGate>}
      />
      <Route
        path="pipelines/:pipelineId/settings"
        element={<PipelinesExperimentalGate><PipelineSettings /></PipelinesExperimentalGate>}
      />
      <Route
        path="pipelines/:pipelineId/items/:caseId"
        element={<PipelinesExperimentalGate><PipelineItemDetail /></PipelinesExperimentalGate>}
      />
      <Route
        path="pipelines/:pipelineId/cases/:caseId"
        element={<PipelinesExperimentalGate><PipelineItemLegacyRedirect /></PipelinesExperimentalGate>}
      />
      <Route path="routines/:routineId" element={streamlinedUiEnabled ? <RoutineDetail /> : <ProductionSurface><ProductionRoutineDetail /></ProductionSurface>} />
      <Route path="routines/:routineId/:section" element={streamlinedUiEnabled ? <RoutineDetail /> : <ProductionSurface><ProductionRoutineDetail /></ProductionSurface>} />
      <Route element={<IsolatedWorkspacesRouteGate />}>
        <Route path="execution-workspaces/:workspaceId" element={<ExecutionWorkspaceDetail />} />
        <Route path="execution-workspaces/:workspaceId/services" element={<ExecutionWorkspaceDetail />} />
        <Route path="execution-workspaces/:workspaceId/configuration" element={<ExecutionWorkspaceDetail />} />
        <Route path="execution-workspaces/:workspaceId/runtime-logs" element={<ExecutionWorkspaceDetail />} />
        <Route path="execution-workspaces/:workspaceId/issues" element={<ExecutionWorkspaceDetail />} />
        <Route path="execution-workspaces/:workspaceId/routines" element={<ExecutionWorkspaceDetail />} />
      </Route>
      <Route path="goals" element={<Goals />} />
      <Route path="goals/:goalId" element={<GoalDetail />} />
      <Route path="artifacts" element={<Artifacts />} />
      <Route path="approvals" element={<Navigate to="/approvals/pending" replace />} />
      <Route path="approvals/pending" element={<Approvals />} />
      <Route path="approvals/all" element={<Approvals />} />
      <Route path="approvals/:approvalId" element={<ApprovalDetail />} />
      <Route path="activity" element={streamlinedUiEnabled ? <CompanyActivity /> : <ProductionSurface><ProductionCompanyActivity /></ProductionSurface>} />
      {streamlinedUiEnabled ? (
        <>
          <Route path="activity/runs" element={<AuditHub section="runs" />} />
          <Route path="activity/costs" element={<AuditHub section="costs" />} />
          <Route path="activity/budgets" element={<AuditHub section="budgets" />} />
          <Route path="activity/timeline" element={<AuditHub section="timeline" />} />
          <Route path="audit" element={<AuditCompatibilityRedirect to="/activity" forceAgentMode />} />
          <Route path="audit/activity" element={<AuditCompatibilityRedirect to="/activity" />} />
          <Route path="audit/runs" element={<AuditCompatibilityRedirect to="/activity/runs" />} />
          <Route path="audit/costs" element={<AuditCompatibilityRedirect to="/activity/costs" />} />
          <Route path="audit/budgets" element={<AuditCompatibilityRedirect to="/activity/budgets" />} />
          <Route path="audit/timeline" element={<AuditCompatibilityRedirect to="/activity/timeline" />} />
          <Route path="runs" element={<AuditCompatibilityRedirect to="/activity/runs" />} />
          <Route path="costs" element={<AuditCompatibilityRedirect to="/activity/costs" />} />
          <Route path="budgets" element={<AuditCompatibilityRedirect to="/activity/budgets" />} />
        </>
      ) : (
        <>
          <Route path="costs" element={<ProductionSurface><ProductionCosts /></ProductionSurface>} />
          <Route path="audit" element={<Navigate to="/activity?mode=agents" replace />} />
        </>
      )}
      {/* Conference Room Chat surfaces (PAP-136/PAP-137): routes stay
          registered but redirect to the company home while the experimental
          flag is off. The board-level `artifacts` mount below is the new
          conference-room one; the master-level mount above it still serves
          `/artifacts` in both modes. */}
      <Route element={<ConferenceRoomChatGate />}>
        <Route path="board-chat" element={<BoardChat />} />
        <Route path="artifacts" element={<Artifacts />} />
      </Route>
      {/* Task chat dev harness — dev builds only. */}
      {import.meta.env.DEV ? (
        <Route path="dev/task-chat-lab" element={<TaskChatLab />} />
      ) : null}
      <Route path="decisions" element={<WhatNeedsMe />} />
      <Route path="decisions/queues/:key" element={<DecisionQueuePage />} />
      {/* Combined Inbox + Task List: Inbox is a view inside Tasks. Every /inbox/* URL still
          resolves — it redirects into the matching view — and with the flag off
          (or in the legacy shell) the standalone pages stay. /inbox/requests
          stays its own page either way; Settings → Members links straight to it. */}
      {mergedTasks ? (
        <>
          <Route path="inbox" element={<InboxRootRedirect />} />
          <Route path="inbox/mine" element={<TaskViewRedirect view="mine" />} />
          <Route path="inbox/recent" element={<TaskViewRedirect view="recent" />} />
          <Route path="inbox/unread" element={<TaskViewRedirect view="unread" />} />
          <Route path="inbox/blocked" element={<TaskViewRedirect view="blocked" />} />
          <Route path="inbox/all" element={<TaskViewRedirect view="everything" />} />
          <Route path="inbox/new" element={<TaskViewRedirect view="mine" />} />
        </>
      ) : (
        <>
          <Route path="inbox" element={<InboxRootRedirect />} />
          <Route path="inbox/mine" element={<Inbox />} />
          <Route path="inbox/recent" element={<Inbox />} />
          <Route path="inbox/unread" element={<Inbox />} />
          <Route path="inbox/blocked" element={<Inbox />} />
          <Route path="inbox/all" element={<Inbox />} />
          <Route path="inbox/new" element={<Navigate to="/inbox/mine" replace />} />
        </>
      )}
      <Route path="inbox/requests" element={<JoinRequestQueue />} />
      <Route path="u/:userSlug" element={<UserProfile />} />
      <Route path="design-guide" element={<DesignGuide />} />
      <Route path="instance/settings/adapters" element={<AdapterManager />} />
      <Route path=":pluginRoutePath/*" element={<PluginPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </>
  );
}

function AppsConnectEntryRoute({
  credentialSource = "paperclip_vault",
}: {
  credentialSource?: ToolConnectionCredentialSource;
} = {}) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const { enabled: chatConnectorsEnabled } = useChatConnectorsEnabled();
  return canEnterAppsConnect(searchParams, { chatConnectorsEnabled })
    ? <AppsConnect credentialSource={credentialSource} />
    : <Navigate to="/apps" replace />;
}

function InboxRootRedirect() {
  const { enabled: streamlinedUiEnabled } = useStreamlinedUiEnabled();
  const { enabled: combinedInboxTasksEnabled } = useCombinedInboxTasksEnabled();
  return streamlinedUiEnabled && combinedInboxTasksEnabled
    ? <TaskViewRedirect view={taskViewForInboxTab(loadLastInboxTab())} />
    : <Navigate to={`/inbox/${loadLastInboxTab()}`} replace />;
}

/** Sends a retired Inbox/Tasks URL to its view on the merged Tasks surface. */
function TaskViewRedirect({ view }: { view: TaskViewKey }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set(TASK_VIEW_PARAM, view);
  return <Navigate to={`/issues?${params.toString()}${location.hash}`} replace />;
}

function LegacySkillStudioRedirect() {
  const location = useLocation();
  const { skillId } = useParams<{ skillId?: string }>();
  if (!skillId) return <Navigate to="/skills/studio" replace />;
  return (
    <Navigate
      to={`/skills/studio/${encodeURIComponent(skillId)}${location.search}${location.hash}`}
      replace
    />
  );
}

function LegacySettingsRedirect() {
  const location = useLocation();
  const { hidden: hiddenSettings } = useHiddenSettings();
  const normalizedPath = filterHiddenInstanceSettingsPath(
    normalizeRememberedInstanceSettingsPath(
      `${location.pathname}${location.search}${location.hash}`,
    ),
    hiddenSettings,
  );
  return <Navigate to={normalizedPath} replace />;
}

function LegacyCompanyPathRedirect() {
  const location = useLocation();
  const rest = location.pathname.replace(/^\/company/, "");
  return <Navigate to={`/organization${rest}${location.search}${location.hash}`} replace />;
}

function LegacyToolsSettingsRedirect() {
  const { tab } = useParams<{ tab?: string }>();
  return <Navigate to={legacyToolsRedirectTarget(tab)} replace />;
}

// The developer "Tools" surface moved under the Apps "Advanced setup" door
// (PAP-10862). `/tools` and `/tools/:tab` redirect to their new home.
function LegacyToolsRedirect() {
  const { tab } = useParams<{ tab?: string }>();
  return <Navigate to={legacyToolsRedirectTarget(tab)} replace />;
}

function legacyToolsRedirectTarget(tab?: string) {
  if (!tab) return "/apps/advanced/profiles";
  if (tab === "applications" || tab === "connections" || tab === "overview" || tab === "examples") return "/apps";
  if (tab === "runtime" || tab === "audit") return "/apps";
  if (tab === "policies") return "/apps/advanced/profiles";
  return `/apps/advanced/${tab}`;
}

export function OnboardingRoutePage() {
  const { organization } = useOrganization();
  const { openOnboarding } = useDialogActions();
  const { t } = useTranslation();
  const cloudInstance = useCloudInstance();
  const createStackUrl = cloudStackCreateUrl(cloudInstance?.cloudBaseUrl ?? null);
  const { onboardingOpen, onboardingRouteDismissed } = useDialogState();
  // The wizard covers the whole screen while active, so the launcher card must
  // not stay focusable/clickable behind it (PAP-52).
  if (isOnboardingWizardActive({ onboardingOpen, routeDismissed: onboardingRouteDismissed })) {
    return null;
  }

  const title = organization
    ? `Add another agent to ${organization.name}`
    : "Create your organization";
  const description = organization
    ? "Run onboarding again to add an agent and a starter task."
    : "Get started by creating your organization and its first agent.";

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4">
          {/* A managed stack with no reachable Cloud origin has nowhere to send
              this click (in-app creation is a 403 floor there), so say why
              instead of rendering an inert control. */}
          {!organization && cloudInstance && !createStackUrl ? (
            <p className="text-sm text-muted-foreground">
              {t("app.cloudCreateUnavailable", {
                defaultValue:
                  "Organizations are created in Paperclip Cloud. This instance can't reach it right now — try again from your Cloud portfolio.",
              })}
            </p>
          ) : (
            <Button
              onClick={() =>
                organization
                  ? openOnboarding({
                      initialStep: onboardingStepForCompany(),
                      companyId: organization.id,
                    })
                  : cloudInstance && createStackUrl
                    ? navigateTopLevel(createStackUrl)
                    : openOnboarding()
              }
            >
              {organization ? "Add Agent" : "Start Onboarding"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusCardsLegacyRedirect() {
  const { cardId } = useParams<{ cardId?: string }>();
  return <Navigate to={`/status${cardId ? `/${cardId}` : ""}`} replace />;
}

function AuditCompatibilityRedirect({
  to,
  forceAgentMode = false,
}: {
  to: string;
  forceAgentMode?: boolean;
}) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  if (forceAgentMode) searchParams.set("mode", "agents");
  const search = searchParams.toString();
  return <Navigate to={`${to}${search ? `?${search}` : ""}${location.hash}`} replace />;
}

function OrganizationUnavailablePage({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">
          {t("app.organizationUnavailable.title", { defaultValue: "Couldn't load the organization" })}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("app.organizationUnavailable.description", {
            defaultValue: "The server did not answer. Check your connection and try again.",
          })}
        </p>
        <div className="mt-4">
          <Button onClick={onRetry}>{t("app.organizationUnavailable.retry", { defaultValue: "Try again" })}</Button>
        </div>
      </div>
    </div>
  );
}

function BoardShell({ streamlinedUiEnabled }: { streamlinedUiEnabled: boolean }) {
  const { organization, loading, error, reload } = useOrganization();
  const location = useLocation();

  if (loading) return <PaperclipLoading />;
  if (!organization) {
    // An error says nothing about whether the organization exists; offering
    // creation here would POST against an instance that may already have one.
    if (error) return <OrganizationUnavailablePage onRetry={() => void reload()} />;
    if (isOnboardingPath(location.pathname)) return <OnboardingRoutePage />;
    return <Navigate to="/onboarding" replace />;
  }

  return streamlinedUiEnabled ? <Layout /> : <ProductionLayout />;
}

export function App() {
  const { enabled: streamlinedUiEnabled, loaded: streamlinedUiLoaded } = useStreamlinedUiEnabled();
  const { enabled: combinedInboxTasksEnabled } = useCombinedInboxTasksEnabled();

  return (
    <>
      <Routes>
        <Route path="oauth-handoff" element={<PaperclipCloudOAuthHandoffPage />} />
        <Route path="auth" element={<AuthPage />} />
        <Route path="board-claim/:token" element={<BoardClaimPage />} />
        <Route path="mcp-connect/:id" element={<McpConnectPage />} />
        <Route path="mcp-device" element={<McpDevicePage />} />
        <Route path="assistant-connections" element={<AssistantConnectionsPage />} />
        <Route path="cli-auth/:id" element={<CliAuthPage />} />
        <Route path="invite/:token" element={<InviteLandingPage />} />
        <Route element={streamlinedUiLoaded ? <CloudAccessGate allowMembershipRequest /> : <PaperclipLoading />}>
          {/* The identity APIs enforce the chat rollout flag. Nonmembers cannot
              read experimental settings, but a private invitation may request membership. */}
          <Route path="chat-identity/confirm" element={<ChatIdentityConfirm />} />
        </Route>
        <Route path="tests/perf/long-thread" element={<IssueChatLongThreadPerf />} />
        <Route path="ux-lab/bootstrap-setup" element={<BootstrapSetupUxLab />} />
        <Route path="ux-lab/responsible-user-denial" element={<ResponsibleUserDenialUxLab />} />
        <Route path="ux-lab/cross-issue-collaboration" element={<CrossIssueCollaborationUxLab />} />

        <Route element={streamlinedUiLoaded ? <CloudAccessGate /> : <PaperclipLoading />}>
          <Route element={<BoardShell streamlinedUiEnabled={streamlinedUiEnabled} />}>
            {boardRoutes(streamlinedUiEnabled, combinedInboxTasksEnabled)}
          </Route>
        </Route>
      </Routes>
      <OnboardingWizardVariant />
    </>
  );
}
