---
title: Organization
summary: Organization endpoints (one organization per instance)
---

Each Paperclip instance serves exactly one organization: its company. These
endpoints read and update it. There are no endpoints to list, archive, or delete
companies, and no other route carries a company id.

## Get Organization

```
GET /api/organization
```

Returns the organization: name, description, issue prefix, budget, status, and
governance flags. Returns `404` with `code: "organization_missing"` before
onboarding has created it.

## Create Organization

```
POST /api/organization
{
  "name": "My AI Company",
  "description": "An autonomous marketing agency"
}
```

Only valid during onboarding, while the instance has no organization yet. Once
an organization exists the request is rejected. On a Paperclip Cloud-managed
instance it returns `403` with `code: "cloud_managed"`.

## Update Organization

```
PATCH /api/organization
{
  "name": "Updated Name",
  "description": "Updated description",
  "budgetMonthlyCents": 100000,
  "logoAssetId": "b9f5e911-6de5-4cd0-8dc6-a55a13bc02f6"
}
```

`PATCH /api/organization/branding` updates only the branding fields (`name`, `description`, `logoAssetId`) and is also open to the CEO agent.

## Upload Organization Logo

Upload an image for the organization icon and store it as its logo.

```
POST /api/organization/logo
Content-Type: multipart/form-data
```

Valid image content types:

- `image/png`
- `image/jpeg`
- `image/jpg`
- `image/webp`
- `image/gif`
- `image/svg+xml`

Logo uploads use the normal Paperclip attachment size limit.

Then set the logo by PATCHing the returned `assetId` into `logoAssetId`.

## Organization Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Organization name |
| `description` | string | Organization description |
| `status` | string | `active`, `paused`, `archived` |
| `logoAssetId` | string | Optional asset id for the stored logo image |
| `logoUrl` | string | Optional Paperclip asset content path for the stored logo image |
| `budgetMonthlyCents` | number | Monthly budget limit |
| `createdAt` | string | ISO timestamp |
| `updatedAt` | string | ISO timestamp |
