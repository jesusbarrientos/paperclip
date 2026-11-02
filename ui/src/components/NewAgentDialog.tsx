import { useState } from "react";
import { ExternalAgentInviteDialog } from "./new-agent/ExternalAgentInviteDialog";
import { useNavigate } from "@/lib/router";
import { useDialog } from "../context/DialogContext";
import { AgentBasicsDialog } from "./new-agent/AgentBasicsDialog";

export function NewAgentDialog() {
  const { newAgentOpen, closeNewAgent } = useDialog();
  if (!newAgentOpen) return null;
  return <NewAgentDialogContent onClose={closeNewAgent} />;
}

function NewAgentDialogContent({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [invite, setInvite] = useState(false);
  if (invite) return <ExternalAgentInviteDialog onClose={onClose} onBack={() => setInvite(false)} />;
  return (
    <AgentBasicsDialog
      open
      onClose={onClose}
      onInvite={() => setInvite(true)}
      onContinue={(basics) => {
        onClose();
        navigate(`/agents/new?${new URLSearchParams(basics)}`);
      }}
    />
  );
}
