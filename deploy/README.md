# Deploy on Dokploy

One Dokploy project, **Paperclip**, with two environments (`production`,
`staging`). Each environment has two separate services: Postgres and the
server (API + UI on port 3100). GitHub Actions builds the image; Dokploy
only pulls it.

| Branch    | Image                                          | Environment | Domain                         |
|-----------|------------------------------------------------|-------------|--------------------------------|
| `staging` | `ghcr.io/jesusbarrientos/paperclip:staging`    | staging     | `paperclip-staging.bazu.casa`  |
| `main`    | `ghcr.io/jesusbarrientos/paperclip:main`       | production  | (later, after staging is good) |

Every push also publishes `:<branch>-<sha7>` for pinning or rollback.

## Staging setup (Dokploy UI)

1. **Project → Environments**: in the Paperclip project, add environment `staging`.
2. **Database**: *Create Service → Database → PostgreSQL*.
   - Name `paperclip-db`, image `postgres:17-alpine`, database `paperclip`, user `paperclip`, generated password.
   - Deploy. Copy the **Internal Host** (looks like `paperclip-db-xxxxx`) from the service page.
3. **Server**: *Create Service → Application*, name `paperclip-server`.
   - *Provider → Docker*: image `ghcr.io/jesusbarrientos/paperclip:staging` (public, no registry needed).
   - *Environment*:
     ```
     DATABASE_URL=postgres://paperclip:<db password>@<internal host>:5432/paperclip
     PORT=3100
     SERVE_UI=true
     PAPERCLIP_DEPLOYMENT_MODE=authenticated
     PAPERCLIP_DEPLOYMENT_EXPOSURE=public
     PAPERCLIP_PUBLIC_URL=https://paperclip-staging.bazu.casa
     PAPERCLIP_TELEMETRY_DISABLED=1
     PAPERCLIP_MIGRATION_AUTO_APPLY=true
     BETTER_AUTH_SECRET=<new: openssl rand -hex 32>
     PAPERCLIP_TOOL_ACTION_SIGNING_SECRET=<new: openssl rand -hex 32>
     PAPERCLIP_SECRETS_MASTER_KEY=<new: openssl rand -hex 32>
     ```
     All three secrets are new for staging, never production's.
   - *Advanced → Volumes*: volume mount, name `paperclip-staging-data`, path `/paperclip`.
   - *Domains*: host `paperclip-staging.bazu.casa`, port `3100`, HTTPS on.
   - Do not deploy yet (the database is loaded first).
4. **Webhook**: *Deployments* tab → copy the Webhook URL. In GitHub,
   repo *Settings → Secrets → Actions*, add `DOKPLOY_WEBHOOK_STAGING` with it.

## Load production data into staging

On srv-01, from a checkout of this repo:

```sh
docker ps --format '{{.Names}}' | grep -i paperclip   # find the three containers
PROD_DB=<prod postgres> STAGING_DB=<staging postgres> STAGING_SERVER=<staging server> \
  ./deploy/staging/refresh.sh
```

`refresh.sh` only reads production (`pg_dump`). On the staging copy,
`sanitize.sql`:

- keeps only the **Apartment List** company;
- deletes every integration: chat connectors (Slack, GitHub, Teams...),
  tool/MCP connections (Jira, GitHub, Slack MCP...), connection grants,
  plugins, company and user secrets, external objects, email endpoints;
- pauses all agents, routines and routine triggers;
- deletes production web sessions and agent API keys.

Users and password hashes are kept, so you log in to staging with your
production credentials. Re-run `refresh.sh` whenever staging should match
production again.

The first time, the server container does not exist until it is deployed
once: deploy the server, wait for it to start, then run `refresh.sh`.
