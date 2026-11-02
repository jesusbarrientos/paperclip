import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dispatchLiveRunnerGoalControl,
  registerLiveRunnerGoalController,
  runnerGoalControlBrokerInternals,
} from "./runner-goal-control-broker.js";

describe("runner goal control broker", () => {
  afterEach(() => runnerGoalControlBrokerInternals.resetForTests());

  it("dispatches controls only to the matching live issue session", async () => {
    const control = vi.fn().mockResolvedValue(undefined);
    const release = registerLiveRunnerGoalController({
      issueId: "issue-1",
      agentId: "agent-1",
      runId: "run-1",
    }, { control });

    expect(dispatchLiveRunnerGoalControl({
      issueId: "issue-other",
      agentId: "agent-1",
    }, {
      requestId: "request-1",
      action: "pause",
    })).toBeNull();

    const dispatched = dispatchLiveRunnerGoalControl({
      issueId: "issue-1",
      agentId: "agent-1",
    }, {
      requestId: "request-1",
      action: "edit",
      objective: "Keep pursuing the issue",
    });
    expect(dispatched?.runId).toBe("run-1");
    await expect(dispatched?.completion).resolves.toBeUndefined();
    expect(control).toHaveBeenCalledWith({
      requestId: "request-1",
      action: "edit",
      objective: "Keep pursuing the issue",
    });

    release();
    expect(dispatchLiveRunnerGoalControl({
      issueId: "issue-1",
      agentId: "agent-1",
    }, {
      requestId: "request-2",
      action: "clear",
    })).toBeNull();
  });

  it("does not let a superseded run unregister the current controller", async () => {
    const firstRelease = registerLiveRunnerGoalController({
      issueId: "issue-1",
      agentId: "agent-1",
      runId: "run-1",
    }, { control: vi.fn().mockResolvedValue(undefined) });
    const currentControl = vi.fn().mockResolvedValue(undefined);
    registerLiveRunnerGoalController({
      issueId: "issue-1",
      agentId: "agent-1",
      runId: "run-2",
    }, { control: currentControl });

    firstRelease();
    const dispatched = dispatchLiveRunnerGoalControl({
      issueId: "issue-1",
      agentId: "agent-1",
    }, {
      requestId: "request-2",
      action: "clear",
    });
    await dispatched?.completion;
    expect(dispatched?.runId).toBe("run-2");
    expect(currentControl).toHaveBeenCalledOnce();
  });
});
