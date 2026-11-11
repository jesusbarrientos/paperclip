# Execution machines

Status: Experimental (distributed development, phases 1–8)
Date: 2026-11-03

An execution machine is a computer that runs agent work for Paperclip. It can
be a developer's Mac, a PC, or the Ubuntu host that runs the server. The
server stays the single coordinator: it chooses the agent configuration,
checks permissions and budgets, and records every run. The machine runs the
commands and keeps the issue's files.

## Concepts

| Term | Meaning |
|---|---|
| Machine | A paired computer with a `paperclipai machine` daemon. Personal machines run only their owner's work; shared machines run work for every board user. |
| Work context | Where the work for one issue lives: the server or one machine. Each issue has one active context. Moving the work creates a new context with a higher fencing token. |
| Fencing token | Increments on every move. A machine that no longer holds the work cannot store snapshots, even if it reconnects later. |
| Snapshot | A git commit of the issue's files, taken outside the work tree's own `.git`. `.gitignore` rules apply, so dependencies and build output never travel. |
| Mirror | A bare git repository per issue on the server (`<instance>/data/work-context-mirrors/<issueId>.git`). It holds every snapshot under `refs/paperclip/wip/<seq>`. |

## Install and pair a machine

```sh
npm install -g paperclipai
paperclipai machine pair --server https://paperclip.example.com --name "My Mac"
```

The command prints an approval URL and opens it. Approve the machine in the
browser while signed in. Only an instance admin can approve a shared machine.
After approval the CLI stores a machine credential in
`~/.paperclip/machine/config.json` (mode `0600`). The credential is issued
once and is never shown again.

Run the daemon in the foreground, or install it as a service:

```sh
paperclipai machine run
paperclipai machine install-service   # launchd on macOS, systemd --user on Linux
paperclipai machine status            # checks the credential against the server
```

The daemon opens one outbound WebSocket to `/api/machines/v1/connect`. It does
not listen on any port. Revoking a machine in **Settings → Machines** closes
its connection and invalidates the credential at once.

## Network

Paperclip does not depend on any network provider. The only requirement is a
public HTTPS URL that every machine can reach. Set it as `PAPERCLIP_PUBLIC_URL`
on the server. Every machine connection is outbound, so a developer laptop
never needs to be reachable.

The machine routes (`/api/machines/v1/*`, `/api/machines/pairings*`) are built
to be exposed directly to the internet:

- Every call carries a machine credential or a single-use pairing token.
- Pairing tokens expire after 15 minutes.
- Credentials are stored hashed.
- Snapshot uploads are bounded (512 MB) and checked against the fencing token.

Common setups (none is required):

- **Reverse proxy with Let's Encrypt** (Caddy, nginx, Traefik, Dokploy). The
  proxy must allow WebSocket upgrades and long-lived connections. The daemon
  reconnects with backoff when the proxy drops an idle connection.
- **Cloudflare Tunnel** or any other tunnel. Do not put an interactive login
  page (such as Cloudflare Access) in front of `/api/machines/*`. The daemon
  cannot complete a browser login. If you need a gate there, use a service
  token and pass it to the daemon with `--header` at pairing time.
- **LAN only**, with a private CA. Point the daemon at the CA with
  `NODE_EXTRA_CA_CERTS`.
- **VPN overlay** (WireGuard, Tailscale, Headscale, ZeroTier). Use the overlay
  address as the public URL.

`paperclipai machine pair --header "Name: value"` stores extra headers in the
machine config. The daemon sends them on every request, including the
WebSocket upgrade.

## Choosing where work runs

The issue page's **Runs on** control and the VS Code extension set the
location:

- `PUT /api/issues/:issueId/execution-location` moves idle work. If the
  source is a connected machine, the server first snapshots it. When the
  target is a machine, the server then brings that machine's copy up to the
  latest snapshot.
- Moves, runs, handoffs and snapshots of one issue run one at a time. A move
  requested while a snapshot is uploading waits for it to finish.
- `POST /api/issues/:issueId/work-context/run` optionally moves the work, then
  wakes the assigned agent.
- `POST /api/issues/:issueId/work-context/handoff` moves work that may be
  running (see below).

Agents cannot choose a machine. A run never moves to another location on its
own. If the selected machine is offline or revoked, the run fails with
`machine_disconnected` and the work stays where it is.

## Sync and handoff

There is one writer at a time. The agent writes while a run is active, and the
issue is read-only in VS Code until the run ends. Otherwise the developer
writes.

- When a run on a machine ends, the server asks that machine to snapshot and
  upload its files.
- `POST /api/issues/:issueId/work-context/sync` takes a snapshot on demand.
- A handoff runs these steps:
  1. It cancels the active run and waits for confirmation.
  2. It takes a final snapshot on the source machine.
  3. It moves the context and increments the fencing token.
  4. It brings the target machine up to the latest snapshot.
  5. It wakes the agent there.
- If the source machine is offline, the handoff stops in `recovery_pending`.
  Repeat it with `"useLastSnapshot": true` to continue from the last stored
  snapshot. The changes made after that snapshot stay on the offline machine.
- If the target has local edits that the snapshot would overwrite (for
  example, made in Fork), the server never overwrites them. The context goes
  to `conflict`, the edited paths are listed in `syncError`, and no run starts.
- A machine whose copy is behind the mirror refuses to upload, so an older
  copy can never hide newer work.

## Dev containers

If the issue's files contain `.devcontainer/devcontainer.json` or
`.devcontainer.json`, and the machine reports both Docker and the
`devcontainer` CLI, the server starts the container when the run acquires its
workspace:

- **Mount path.** The workspace is mounted at the same path it has on the host,
  so every path the server sends is valid inside the container.
- **What runs inside.** Only commands whose working directory is inside the
  issue workspace run in the container. Staging and bootstrap commands run on
  the host.
- **Lifetime.** The container stays up between runs. It stops when the work
  leaves the machine or when the VS Code window that started it closes.
- **Requirement.** The container image must include the agent CLI (for example
  `claude`). The daemon does not install it there.

A repository without a dev container runs on the machine's host, with the
tools installed there (for example, Xcode on a Mac).

## VS Code extension

`packages/vscode-extension` signs in with the same browser-approved flow as
the CLI and keeps the board key in VS Code `SecretStorage`. It offers:

- the issue list;
- a chat panel with the live run transcript, permission cards and an interrupt
  button;
- "Run on This Machine", "Run on Server" and "Move Work" commands;
- a status bar entry with the issue, the location and the edit lock.

Other behavior:

- The extension starts the local daemon when the machine is paired but not
  connected. A daemon it started stops when the window closes.
- Each window reports a client session. Closing the window, or 90 seconds
  without a report, pauses only that window's machine runs. Server runs keep
  going.
- In the managed workspace (**Paperclip: Open Paperclip Workspace**), the
  issue's folders replace the previous issue's folders without reloading the
  window. While a run is active, they are read-only through
  `files.readonlyInclude`.

## Security notes

- A personal machine runs only its owner's work. Instance admins can see it
  and revoke it, but cannot run work on it.
- The daemon only reads and writes under its workspace root. Paths the server
  sends from outside that root are refused.
- Commands receive only the environment the server sends, plus an allowlist
  of host variables (`PATH`, `HOME`, `USER`, `LOGNAME`, `SHELL`, `LANG`,
  `LC_ALL`, `TMPDIR`, `TERM`). The rest of the daemon's environment, including
  provider keys, is not passed through.
- Secrets reach a machine only inside the environment of the run that needs
  them. They are not written to the machine config.

## Known limits

- The extension's read-only lock covers VS Code only. Edits from other tools
  surface as sync conflicts.
- Conflict resolution has no UI yet. To resolve one, move the work back or
  clean the target's copy, then retry.
- Several repositories inside one context are synced as one tree. Nested
  repositories are stored as gitlinks, not as their contents.
- A per-context Docker network for multi-repository systems is not built yet.
- Moving work to the `server` location keeps the snapshot in the mirror, but it
  does not unpack it into the server's agent workspace. To run on the Ubuntu
  host with the synced files, pair it as a shared machine.
