// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildPermissionsForTrustPreset,
  clearSingleLowTrustBoundaryTarget,
  getLowTrustBoundary,
  getSingleLowTrustBoundaryTarget,
  isCeLowTrustBoundaryEditable,
  setSingleLowTrustBoundaryTarget,
  summarizeLowTrustBoundaryTarget,
} from "./trust-policy-ui";

describe("trust-policy-ui low-trust boundary helpers", () => {
  it("drops hire authority when switching to the low-trust preset", () => {
    const demoted = buildPermissionsForTrustPreset(
      { canCreateAgents: true, canCreateSkills: true },
      "low_trust_review",
    );
    expect(demoted.canCreateAgents).toBe(false);
    expect(demoted.canCreateSkills).toBe(true);

    const restored = buildPermissionsForTrustPreset(demoted, "standard");
    expect(restored.canCreateAgents).toBe(false);
    expect(restored.trustPreset).toBe("standard");
  });

  it("clears containment across a JSON permissions patch when restoring standard trust", () => {
    const lowTrust = setSingleLowTrustBoundaryTarget(null, { type: "root_issue", id: "issue-1" });
    const patch = JSON.parse(JSON.stringify(buildPermissionsForTrustPreset(lowTrust, "standard")));
    const persisted = { ...lowTrust, ...patch };
    expect(persisted.trustPreset).toBe("standard");
    expect(persisted.authorizationPolicy).toEqual({});
    expect(getLowTrustBoundary(persisted)).toBeNull();
  });

  it("writes one project boundary with mode", () => {
    const permissions = setSingleLowTrustBoundaryTarget(null, {
      type: "project",
      id: "project-1",
    });

    expect(permissions).toMatchObject({
      trustPreset: "low_trust_review",
      authorizationPolicy: {
        trustPreset: "low_trust_review",
        reviewPreset: {
          id: "low_trust_review",
          version: 1,
          rawOutputDisposition: "quarantine",
        },
        trustBoundary: {
          mode: "low_trust_review",
          projectIds: ["project-1"],
        },
      },
    });
  });

  it("clears other scope fields while preserving non-scope policy fields", () => {
    const permissions = setSingleLowTrustBoundaryTarget(
      {
        trustPreset: "low_trust_review",
        authorizationPolicy: {
          customEeField: { mode: "preserved" },
          trustBoundary: {
            mode: "low_trust_review",
            projectIds: ["project-1"],
            rootIssueId: "root-1",
            issueIds: ["issue-1"],
            allowedToolClasses: ["git.read"],
          },
        },
      },
      { type: "issue", id: "issue-2" },
    );

    expect(permissions.authorizationPolicy).toMatchObject({
      customEeField: { mode: "preserved" },
      trustBoundary: {
        mode: "low_trust_review",
        issueIds: ["issue-2"],
        allowedToolClasses: ["git.read"],
      },
    });
    expect(permissions.authorizationPolicy?.trustBoundary?.projectIds).toBeUndefined();
    expect(permissions.authorizationPolicy?.trustBoundary?.rootIssueId).toBeUndefined();
  });

  it("hydrates one existing root issue boundary", () => {
    const boundary = getLowTrustBoundary({
      trustPreset: "low_trust_review",
      authorizationPolicy: {
        trustBoundary: {
          mode: "low_trust_review",
          rootIssueId: "issue-root",
        },
      },
    });

    expect(getSingleLowTrustBoundaryTarget(boundary)).toEqual({ type: "root_issue", id: "issue-root" });
    expect(summarizeLowTrustBoundaryTarget(boundary)).toBe("Root issue issue-ro");
  });

  it("marks multi-boundary policies read-only for CE", () => {
    const boundary = {
      mode: "low_trust_review" as const,
      projectIds: ["project-1", "project-2"],
    };

    expect(isCeLowTrustBoundaryEditable(boundary)).toBe(false);
    expect(getSingleLowTrustBoundaryTarget(boundary)).toBeNull();
    expect(summarizeLowTrustBoundaryTarget(boundary)).toBe("2 boundaries");
  });

  it("clears the CE boundary without removing non-scope fields", () => {
    const permissions = clearSingleLowTrustBoundaryTarget({
      trustPreset: "low_trust_review",
      authorizationPolicy: {
        trustBoundary: {
          mode: "low_trust_review",
          issueIds: ["issue-1"],
          allowedSecretBindingIds: ["binding-1"],
        },
      },
    });

    expect(permissions.authorizationPolicy?.trustBoundary).toEqual({
      mode: "low_trust_review",
      allowedSecretBindingIds: ["binding-1"],
    });
  });
});
