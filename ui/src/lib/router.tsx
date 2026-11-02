import * as React from "react";
import * as RouterDom from "react-router-dom";
import type { Issue } from "@paperclipai/shared";
import { IssueLinkQuicklook } from "@/components/IssueLinkQuicklook";
import { parseIssuePathIdFromPath } from "@/lib/issue-reference";

export function caseHref(...segments: string[]): string {
  return `/${["cases", ...segments].filter(Boolean).join("/")}`;
}

export * from "react-router-dom";

type BoardLinkProps = React.ComponentProps<typeof RouterDom.Link> & {
  disableIssueQuicklook?: boolean;
  issuePrefetch?: Issue | null;
  issueQuicklookSide?: React.ComponentProps<typeof IssueLinkQuicklook>["issueQuicklookSide"];
  issueQuicklookAlign?: React.ComponentProps<typeof IssueLinkQuicklook>["issueQuicklookAlign"];
};

export const Link = React.forwardRef<HTMLAnchorElement, BoardLinkProps>(
  function BoardLink({
    to,
    disableIssueQuicklook = false,
    issuePrefetch = null,
    issueQuicklookSide,
    issueQuicklookAlign,
    ...props
  }, ref) {
    const issuePathId = parseIssuePathIdFromPath(typeof to === "string" ? to : to.pathname);

    if (issuePathId) {
      return (
        <IssueLinkQuicklook
          ref={ref}
          to={to}
          issuePathId={issuePathId}
          disableIssueQuicklook={disableIssueQuicklook}
          issuePrefetch={issuePrefetch}
          issueQuicklookSide={issueQuicklookSide}
          issueQuicklookAlign={issueQuicklookAlign}
          {...props}
        />
      );
    }

    return <RouterDom.Link ref={ref} to={to} {...props} />;
  },
);
