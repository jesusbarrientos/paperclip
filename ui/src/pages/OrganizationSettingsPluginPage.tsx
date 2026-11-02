import { useEffect, useMemo } from "react";
import { useParams } from "@/lib/router";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useOrganization } from "@/context/OrganizationContext";
import { PluginSlotMount, usePluginSlots } from "@/plugins/slots";
import { NotFoundPage } from "./NotFound";

export function OrganizationSettingsPluginPage() {
  const { settingsRoutePath } = useParams<{ settingsRoutePath?: string }>();
  const { organization } = useOrganization();
  const { setBreadcrumbs } = useBreadcrumbs();

  const { slots, isLoading, errorMessage } = usePluginSlots({
    slotTypes: ["companySettingsPage"],
    enabled: Boolean(organization && settingsRoutePath),
  });

  const pageSlots = useMemo(() => {
    if (!settingsRoutePath) return [];
    return slots.filter((slot) => slot.routePath === settingsRoutePath);
  }, [settingsRoutePath, slots]);

  const pageSlot = pageSlots.length === 1 ? pageSlots[0] : null;

  useEffect(() => {
    if (!pageSlot) return;
    setBreadcrumbs([
      { label: "Settings", href: "/organization/settings" },
      { label: pageSlot.displayName },
    ]);
  }, [pageSlot, setBreadcrumbs]);

  if (!settingsRoutePath || isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (errorMessage) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        Plugin extensions unavailable: {errorMessage}
      </div>
    );
  }

  if (pageSlots.length > 1) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        Multiple plugins declare the organization settings route <code>{settingsRoutePath}</code>. Disable one plugin or change its route.
      </div>
    );
  }

  if (!pageSlot) {
    return <NotFoundPage />;
  }

  return (
    <div className="max-w-6xl">
      <PluginSlotMount
        slot={pageSlot}
        context={{}}
        className="min-h-(--sz-200px)"
        missingBehavior="placeholder"
      />
    </div>
  );
}
