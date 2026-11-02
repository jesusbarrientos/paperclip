import { useOrganization } from "@/context/OrganizationContext";
import { cn, SIDEBAR_RAIL_HIDDEN_LABEL } from "@/lib/utils";
import { useSidebar } from "../context/SidebarContext";
import { CompanyPatternIcon } from "./CompanyPatternIcon";

export function SidebarOrganizationHeader() {
  const { organization } = useOrganization();
  const { collapsed, peeking } = useSidebar();
  const rail = collapsed && !peeking;

  if (!organization) return null;

  return (
    // `min-w-0` on each flex link lets a long name truncate instead of widening the sidebar.
    <div className="flex h-9 min-w-0 flex-1 items-center gap-2 px-4">
      <CompanyPatternIcon
        companyName={organization.name}
        logoUrl={organization.logoUrl}
        className="size-5 shrink-0 rounded-md text-(length:--text-micro)"
      />
      <span
        className={cn("min-w-0 truncate text-sm font-bold text-foreground", rail && SIDEBAR_RAIL_HIDDEN_LABEL)}
        title={organization.name}
      >
        {organization.name}
      </span>
    </div>
  );
}
