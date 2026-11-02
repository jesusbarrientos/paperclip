import { useEffect } from "react";
import { useParams } from "@/lib/router";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useOrganization } from "@/context/OrganizationContext";
import { advancedTabHref } from "../tool-tabs";
import { ToolsAdminGate } from "./ToolsAdminGate";
import { ProfileDetail } from "./ProfileDetail";

export function ProfileDetailRoute() {
  const { organization } = useOrganization();
  const { setBreadcrumbs } = useBreadcrumbs();
  const params = useParams<{ profileId?: string }>();

  useEffect(() => {
    setBreadcrumbs([
      { label: organization?.name ?? "Organization", href: "/dashboard" },
      { label: "Apps", href: "/apps" },
      { label: "Access profiles", href: advancedTabHref("profiles") },
      { label: "Profile detail" },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, organization?.name]);

  if (!params.profileId) {
    return <div className="p-6 text-sm text-muted-foreground">Select a profile.</div>;
  }

  return (
    <ToolsAdminGate>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
        <ProfileDetail profileId={params.profileId} />
      </div>
    </ToolsAdminGate>
  );
}
