import os from "node:os";
import path from "node:path";
import { escapeSystemd, escapeXml } from "../../services/service-manager.js";
import { EXIT_REVOKED } from "./daemon.js";

export const LAUNCHD_LABEL = "ai.paperclip.machine";
export const SYSTEMD_UNIT_NAME = "paperclip-machine.service";

export interface MachineServiceInput {
  programArguments: string[];
  paperclipHome: string;
  pathEnv: string;
  logPath: string;
}

export function resolveLaunchdPlistPath(homeDir = os.homedir()): string {
  return path.join(homeDir, "Library", "LaunchAgents", `${LAUNCHD_LABEL}.plist`);
}

export function resolveSystemdUnitPath(homeDir = os.homedir()): string {
  return path.join(homeDir, ".config", "systemd", "user", SYSTEMD_UNIT_NAME);
}

export function renderMachineLaunchdPlist(input: MachineServiceInput): string {
  const args = input.programArguments.map((arg) => `<string>${escapeXml(arg)}</string>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>${args}</array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${escapeXml(input.pathEnv)}</string>
    <key>PAPERCLIP_HOME</key><string>${escapeXml(input.paperclipHome)}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>${escapeXml(input.logPath)}</string>
  <key>StandardErrorPath</key><string>${escapeXml(input.logPath)}</string>
</dict>
</plist>
`;
}

export function renderMachineSystemdUnit(input: MachineServiceInput): string {
  const execStart = input.programArguments.map((arg) => `"${escapeSystemd(arg)}"`).join(" ");
  return `[Unit]
Description=Paperclip machine daemon
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=${execStart}
Environment="PATH=${escapeSystemd(input.pathEnv)}"
Environment="PAPERCLIP_HOME=${escapeSystemd(input.paperclipHome)}"
WorkingDirectory=%h
Restart=on-failure
RestartSec=5
RestartPreventExitStatus=${EXIT_REVOKED}
TimeoutStopSec=15

[Install]
WantedBy=default.target
`;
}
