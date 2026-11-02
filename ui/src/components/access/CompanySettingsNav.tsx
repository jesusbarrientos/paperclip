import { PageTabBar } from "@/components/PageTabBar";
import { Tabs } from "@/components/ui/tabs";
import { useCloudInstance } from "@/hooks/useCloudInstance";
import { useHiddenSettings } from "@/hooks/useHiddenSettings";
import { INSTANCE_SETTINGS_PATH_PREFIX } from "@/lib/instance-settings";
import { useLocation, useNavigate } from "@/lib/router";

const items = [
  { value: "general", label: "General", href: "/organization/settings" },
  { value: "export", label: "Export", href: "/organization/export" },
  { value: "import", label: "Import", href: "/organization/import" },
  { value: "members", label: "Members", href: "/organization/settings/members" },
  { value: "secrets", label: "Secrets", href: "/organization/settings/secrets" },
  { value: "instance-profile", label: "Profile", href: `${INSTANCE_SETTINGS_PATH_PREFIX}/profile` },
  { value: "instance-environments", label: "Environments", href: `${INSTANCE_SETTINGS_PATH_PREFIX}/environments` },
  { value: "instance-access", label: "Access", href: `${INSTANCE_SETTINGS_PATH_PREFIX}/access` },
  { value: "instance-experimental", label: "Experimental", href: `${INSTANCE_SETTINGS_PATH_PREFIX}/experimental` },
  { value: "instance-plugins", label: "Plugins", href: `${INSTANCE_SETTINGS_PATH_PREFIX}/plugins` },
  { value: "instance-adapters", label: "Adapters", href: `${INSTANCE_SETTINGS_PATH_PREFIX}/adapters` },
] as const;

type CompanySettingsTab = (typeof items)[number]["value"];

/** Tab values suppressed when their page is operator-hidden. */
const hiddenSettingKeyByTab: Partial<Record<CompanySettingsTab, string>> = {
  export: "company.export",
  import: "company.import",
  members: "company.members",
  secrets: "company.secrets",
  "instance-profile": "instance.profile",
  "instance-environments": "instance.environments",
  "instance-access": "instance.access",
  "instance-experimental": "instance.experimental",
  "instance-plugins": "instance.plugins",
  "instance-adapters": "instance.adapters",
};

export function getCompanySettingsTab(pathname: string): CompanySettingsTab {
  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/profile`)) {
    return "instance-profile";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/environments`)) {
    return "instance-environments";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/access`)) {
    return "instance-access";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/experimental`)) {
    return "instance-experimental";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/plugins`)) {
    return "instance-plugins";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/adapters`)) {
    return "instance-adapters";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/general`)) {
    return "general";
  }

  if (pathname.includes("/organization/settings/environments")) {
    return "instance-environments";
  }

  if (pathname.includes("/organization/export")) {
    return "export";
  }

  if (pathname.includes("/organization/import")) {
    return "import";
  }

  if (pathname.includes("/organization/settings/members") || pathname.includes("/organization/settings/access")) {
    return "members";
  }

  if (pathname.includes("/organization/settings/invites")) {
    // Invites live on the Members page now; the old URL redirects there.
    return "members";
  }

  if (pathname.includes("/organization/settings/secrets")) {
    return "secrets";
  }

  return "general";
}

export function CompanySettingsNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hidden: hiddenSettings } = useHiddenSettings();
  // Import is floored server-side on cloud-managed instances (403 cloud_managed), so the
  // tab is suppressed there rather than dead-ending.
  const isCloud = Boolean(useCloudInstance());
  const activeTab = getCompanySettingsTab(location.pathname);
  const visibleItems = items.filter((item) => {
    if (item.value === "import" && isCloud) return false;
    const hiddenKey = hiddenSettingKeyByTab[item.value];
    return !hiddenKey || !hiddenSettings.has(hiddenKey);
  });

  function handleTabChange(value: string) {
    const nextTab = visibleItems.find((item) => item.value === value);
    if (!nextTab || nextTab.value === activeTab) return;
    navigate(nextTab.href);
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <PageTabBar
        items={visibleItems.map(({ value, label }) => ({ value, label }))}
        value={activeTab}
        onValueChange={handleTabChange}
        align="start"
      />
    </Tabs>
  );
}
