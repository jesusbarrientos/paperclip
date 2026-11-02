import { and, asc, eq, max, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companySkills, folders, routines } from "@paperclipai/db";
import type {
  CreateFolder,
  Folder,
  FolderKind,
  FolderListResult,
  MoveFolder,
  MoveFolderItem,
  UpdateFolder,
} from "@paperclipai/shared";
import { conflict, forbidden, notFound, unprocessable } from "../errors.js";

const MAX_FOLDER_DEPTH = 4;
const RESERVED_ROOT_SLUGS = new Set(["bundled", "my", "projects"]);
const RESERVED_CHILD_ROOT_SYSTEM_KEYS = new Set(["my", "projects"]);

type FolderRow = typeof folders.$inferSelect;

function isPostgresError(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function normalizeName(name: string) {
  return name.trim();
}

function normalizeColor(color: string | null | undefined) {
  if (color === undefined) return undefined;
  const trimmed = color?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeFolderSlug(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return slug || "folder";
}

function buildFolderViews(rows: FolderRow[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const views = new Map<string, Folder>();
  const visiting = new Set<string>();

  function resolve(row: FolderRow): Folder {
    const existing = views.get(row.id);
    if (existing) return existing;
    if (visiting.has(row.id)) throw unprocessable("Folder hierarchy contains a cycle");
    visiting.add(row.id);
    const parent = row.parentId ? byId.get(row.parentId) : null;
    if (row.parentId && !parent) throw unprocessable("Folder hierarchy contains an invalid parent");
    const parentView = parent ? resolve(parent) : null;
    const view: Folder = {
      ...row,
      parentId: row.parentId ?? null,
      systemKey: row.systemKey ?? null,
      color: row.color ?? null,
      path: parentView ? `${parentView.path}/${row.slug}` : row.slug,
      depth: (parentView?.depth ?? 0) + 1,
    };
    visiting.delete(row.id);
    views.set(row.id, view);
    return view;
  }

  for (const row of rows) resolve(row);
  return views;
}

export function folderService(db: Db, mutationLockHeld = false) {
  async function withCompanyFolderLock<T>(operation: (lockedDb: Db) => Promise<T>) {
    if (mutationLockHeld) return operation(db);
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"paperclip:folders"}, 0))`);
      return operation(tx as unknown as Db);
    });
  }

  async function getRows(kind: FolderKind) {
    return db
      .select()
      .from(folders)
      .where(eq(folders.kind, kind))
      .orderBy(asc(folders.position), asc(folders.name), asc(folders.id));
  }

  async function getFolderRow(folderId: string) {
    return db
      .select()
      .from(folders)
      .where(eq(folders.id, folderId))
      .then((rows) => rows[0] ?? null);
  }

  async function getFolder(folderId: string) {
    const row = await getFolderRow(folderId);
    if (!row) return null;
    const views = buildFolderViews(await getRows(row.kind));
    return views.get(row.id) ?? null;
  }

  async function assertNoSlugConflict(
    kind: FolderKind,
    parentId: string | null,
    slug: string,
    excludeFolderId?: string,
  ) {
    const existing = await db
      .select({ id: folders.id })
      .from(folders)
      .where(and(
        eq(folders.kind, kind),
        parentId === null ? sql`${folders.parentId} is null` : eq(folders.parentId, parentId),
        eq(folders.slug, slug),
      ))
      .then((rows) => rows[0] ?? null);
    if (existing && existing.id !== excludeFolderId) {
      throw conflict("Folder slug already exists under this parent");
    }
  }

  async function nextPosition(kind: FolderKind, parentId: string | null) {
    const row = await db
      .select({ value: max(folders.position) })
      .from(folders)
      .where(and(
        eq(folders.kind, kind),
        parentId === null ? sql`${folders.parentId} is null` : eq(folders.parentId, parentId),
      ))
      .then((rows) => rows[0] ?? null);
    return Number(row?.value ?? -1) + 1;
  }

  async function routineCounts() {
    return db
      .select({ folderId: routines.folderId, count: sql<number>`count(*)::int` })
      .from(routines)
      .groupBy(routines.folderId);
  }

  async function skillCounts() {
    return db
      .select({ folderId: companySkills.folderId, count: sql<number>`count(*)::int` })
      .from(companySkills)
      .groupBy(companySkills.folderId);
  }

  async function list(kind: FolderKind): Promise<FolderListResult> {
    const [folderRows, countRows] = await Promise.all([
      getRows(kind),
      kind === "routine" ? routineCounts() : skillCounts(),
    ]);
    const views = buildFolderViews(folderRows);
    const countsByFolderId = new Map<string | null, number>();
    for (const row of countRows) countsByFolderId.set(row.folderId ?? null, Number(row.count ?? 0));
    return {
      kind,
      folders: folderRows.map((row) => ({
        ...views.get(row.id)!,
        itemCount: countsByFolderId.get(row.id) ?? 0,
      })),
      allCount: Array.from(countsByFolderId.values()).reduce((sum, count) => sum + count, 0),
      unfiledCount: countsByFolderId.get(null) ?? 0,
    };
  }

  function isReservedRootSlug(kind: FolderKind, parentId: string | null, slug: string) {
    return kind === "skill" && parentId === null && RESERVED_ROOT_SLUGS.has(slug);
  }

  async function isBundledFolder(folderId: string) {
    let current = await getFolder(folderId);
    const visited = new Set<string>();
    while (current) {
      if (current.systemKey === "bundled") return true;
      if (!current.parentId || visited.has(current.id)) return false;
      visited.add(current.id);
      current = await getFolder(current.parentId);
    }
    return false;
  }

  async function assertMutableFolder(folder: Folder) {
    if (folder.systemKey || await isBundledFolder(folder.id)) {
      throw forbidden("System-managed folders cannot be changed");
    }
  }

  async function validateParent(kind: FolderKind, parentId: string | null) {
    if (!parentId) return null;
    const parent = await getFolder(parentId);
    if (!parent || parent.kind !== kind) throw notFound("Parent folder not found");
    if (await isBundledFolder(parent.id)) throw forbidden("Bundled folders are read-only");
    if (
      parent.kind === "skill"
      && parent.parentId === null
      && (RESERVED_CHILD_ROOT_SYSTEM_KEYS.has(parent.systemKey ?? "") || RESERVED_CHILD_ROOT_SYSTEM_KEYS.has(parent.slug))
    ) {
      throw forbidden("Reserved skill folders are system-managed");
    }
    return parent;
  }

  async function create(input: CreateFolder): Promise<Folder> {
    if (!mutationLockHeld) {
      return withCompanyFolderLock((lockedDb) => folderService(lockedDb, true).create(input));
    }
    const parentId = input.parentId ?? null;
    const parent = await validateParent(input.kind, parentId);
    if ((parent?.depth ?? 0) + 1 > MAX_FOLDER_DEPTH) {
      throw unprocessable(`Folder depth cannot exceed ${MAX_FOLDER_DEPTH}`);
    }
    const name = normalizeName(input.name);
    const slug = input.slug ?? normalizeFolderSlug(name);
    if (isReservedRootSlug(input.kind, parentId, slug)) {
      throw forbidden("Reserved skill folders are system-managed");
    }
    await assertNoSlugConflict(input.kind, parentId, slug);
    const position = input.position ?? await nextPosition(input.kind, parentId);
    let row: FolderRow;
    try {
      row = await db
        .insert(folders)
        .values({ kind: input.kind, parentId, name, slug, color: normalizeColor(input.color) ?? null, position })
        .returning()
        .then((rows) => rows[0]!);
    } catch (error) {
      if (isPostgresError(error, "23505")) throw conflict("Folder slug already exists under this parent");
      throw error;
    }
    return (await getFolder(row.id))!;
  }

  async function update(folderId: string, patch: UpdateFolder): Promise<Folder | null> {
    if (!mutationLockHeld) {
      return withCompanyFolderLock((lockedDb) => folderService(lockedDb, true).update(folderId, patch));
    }
    const existing = await getFolder(folderId);
    if (!existing) return null;
    await assertMutableFolder(existing);
    const name = patch.name === undefined ? existing.name : normalizeName(patch.name);
    const slug = patch.slug ?? (patch.name === undefined ? existing.slug : normalizeFolderSlug(name));
    if (isReservedRootSlug(existing.kind, existing.parentId, slug)) {
      throw forbidden("Reserved skill folders are system-managed");
    }
    await assertNoSlugConflict(existing.kind, existing.parentId, slug, existing.id);
    try {
      await db
        .update(folders)
        .set({
          name,
          slug,
          color: patch.color === undefined ? existing.color : normalizeColor(patch.color),
          position: patch.position ?? existing.position,
          updatedAt: new Date(),
        })
        .where(eq(folders.id, folderId));
    } catch (error) {
      if (isPostgresError(error, "23505")) throw conflict("Folder slug already exists under this parent");
      throw error;
    }
    return getFolder(folderId);
  }

  function descendantIdsFromRows(rows: FolderRow[], folderId: string) {
    if (!rows.some((row) => row.id === folderId)) throw notFound("Folder not found");
    const children = new Map<string, string[]>();
    for (const row of rows) {
      if (!row.parentId) continue;
      children.set(row.parentId, [...(children.get(row.parentId) ?? []), row.id]);
    }
    const result = new Set([folderId]);
    const queue = [folderId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const childId of children.get(current) ?? []) {
        if (result.has(childId)) throw unprocessable("Folder hierarchy contains a cycle");
        result.add(childId);
        queue.push(childId);
      }
    }
    return result;
  }

  async function descendantIds(kind: FolderKind, folderId: string) {
    return descendantIdsFromRows(await getRows(kind), folderId);
  }

  async function moveFolder(folderId: string, input: MoveFolder): Promise<Folder | null> {
    if (!mutationLockHeld) {
      return withCompanyFolderLock((lockedDb) => folderService(lockedDb, true).moveFolder(folderId, input));
    }
    const existing = await getFolder(folderId);
    if (!existing) return null;
    await assertMutableFolder(existing);
    const parentId = input.parentId === undefined ? existing.parentId : input.parentId;
    if (parentId === existing.id) throw unprocessable("A folder cannot be its own parent");
    const rows = await getRows(existing.kind);
    const descendants = descendantIdsFromRows(rows, existing.id);
    if (parentId && descendants.has(parentId)) throw unprocessable("A folder cannot be moved into its own subtree");
    const parent = await validateParent(existing.kind, parentId);
    const views = buildFolderViews(rows);
    const relativeDepth = Math.max(...Array.from(descendants).map((id) => views.get(id)!.depth - existing.depth + 1));
    if ((parent?.depth ?? 0) + relativeDepth > MAX_FOLDER_DEPTH) {
      throw unprocessable(`Folder depth cannot exceed ${MAX_FOLDER_DEPTH}`);
    }
    if (isReservedRootSlug(existing.kind, parentId, existing.slug)) {
      throw forbidden("Reserved skill folders are system-managed");
    }
    await assertNoSlugConflict(existing.kind, parentId, existing.slug, existing.id);
    try {
      await db
        .update(folders)
        .set({ parentId, position: input.position, updatedAt: new Date() })
        .where(eq(folders.id, folderId));
    } catch (error) {
      if (isPostgresError(error, "23505")) throw conflict("Folder slug already exists under this parent");
      if (isPostgresError(error, "23503")) throw conflict("Parent folder changed during move");
      throw error;
    }
    return getFolder(folderId);
  }

  async function deleteFolder(folderId: string): Promise<Folder | null> {
    if (!mutationLockHeld) {
      return withCompanyFolderLock((lockedDb) => folderService(lockedDb, true).deleteFolder(folderId));
    }
    const existing = await getFolder(folderId);
    if (!existing) return null;
    await assertMutableFolder(existing);
    const child = await db
      .select({ id: folders.id })
      .from(folders)
      .where(eq(folders.parentId, folderId))
      .then((rows) => rows[0] ?? null);
    if (child) throw conflict("Move or delete nested folders first");
    try {
      await db.delete(folders).where(eq(folders.id, folderId));
    } catch (error) {
      if (isPostgresError(error, "23503")) throw conflict("Move or delete nested folders first");
      throw error;
    }
    return existing;
  }

  async function validateSkillFolder(folderId: string, options?: { allowBundled?: boolean }) {
    const folder = await getFolder(folderId);
    if (!folder || folder.kind !== "skill") throw notFound("Skill folder not found");
    if (!options?.allowBundled && await isBundledFolder(folder.id)) {
      throw forbidden("Bundled folders are read-only");
    }
    return folder;
  }

  async function moveItem(input: MoveFolderItem) {
    if (input.folderId) {
      const target = await getFolder(input.folderId);
      if (!target) throw notFound("Folder not found");
      if (target.kind !== input.kind) throw unprocessable("Folder kind must match item kind");
      if (await isBundledFolder(target.id)) throw forbidden("Bundled folders are read-only");
    }
    if (input.kind === "routine") {
      const row = await db
        .update(routines)
        .set({ folderId: input.folderId ?? null, updatedAt: new Date() })
        .where(eq(routines.id, input.itemId))
        .returning({ id: routines.id, folderId: routines.folderId })
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Routine not found");
      return { kind: input.kind, itemId: row.id, folderId: row.folderId ?? null };
    }
    const existing = await db
      .select({ id: companySkills.id, folderId: companySkills.folderId })
      .from(companySkills)
      .where(eq(companySkills.id, input.itemId))
      .then((rows) => rows[0] ?? null);
    if (!existing) throw notFound("Skill not found");
    if (existing.folderId && await isBundledFolder(existing.folderId)) {
      throw forbidden("Bundled skills cannot be moved");
    }
    const row = await db
      .update(companySkills)
      .set({ folderId: input.folderId ?? null, updatedAt: new Date() })
      .where(eq(companySkills.id, input.itemId))
      .returning({ id: companySkills.id, folderId: companySkills.folderId })
      .then((rows) => rows[0]!);
    return { kind: input.kind, itemId: row.id, folderId: row.folderId ?? null };
  }

  async function uniqueSiblingSlug(parentId: string | null, baseSlug: string, stableSuffix: string) {
    const siblingSlugs = new Set(await db
      .select({ slug: folders.slug })
      .from(folders)
      .where(and(
        eq(folders.kind, "skill"),
        parentId === null ? sql`${folders.parentId} is null` : eq(folders.parentId, parentId),
      ))
      .then((rows) => rows.map((row) => row.slug)));
    if (!siblingSlugs.has(baseSlug)) return baseSlug;
    const suffix = normalizeFolderSlug(stableSuffix).slice(0, 24);
    let candidate = `${baseSlug}-${suffix}`;
    let duplicateNumber = 2;
    while (siblingSlugs.has(candidate)) {
      candidate = `${baseSlug}-${suffix}-${duplicateNumber}`;
      duplicateNumber += 1;
    }
    return candidate;
  }

  async function findSystemFolder(systemKey: string) {
    return db
      .select()
      .from(folders)
      .where(and(
        eq(folders.kind, "skill"),
        eq(folders.systemKey, systemKey),
      ))
      .then((rows) => rows[0] ?? null);
  }

  async function insertSystemFolder(input: {
    parentId: string | null;
    name: string;
    slug: string;
    systemKey: string;
  }) {
    const inserted = await db
      .insert(folders)
      .values({
        kind: "skill",
        parentId: input.parentId,
        name: input.name,
        slug: input.slug,
        systemKey: input.systemKey,
        position: await nextPosition("skill", input.parentId),
      })
      .onConflictDoNothing()
      .returning({ id: folders.id })
      .then((rows) => rows[0] ?? null);
    if (inserted) return (await getFolder(inserted.id))!;
    const existing = await findSystemFolder(input.systemKey);
    return existing ? (await getFolder(existing.id))! : null;
  }

  async function ensureContainer(slug: "bundled" | "my" | "projects", name: string) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existingSystem = await findSystemFolder(slug);
      if (existingSystem) return (await getFolder(existingSystem.id))!;
      const squatted = await db
        .select({ id: folders.id })
        .from(folders)
        .where(and(
          eq(folders.kind, "skill"),
          sql`${folders.parentId} is null`,
          eq(folders.slug, slug),
        ))
        .then((rows) => rows[0] ?? null);
      if (squatted) {
        await db
          .update(folders)
          .set({ slug: await uniqueSiblingSlug(null, slug, squatted.id.slice(0, 8)), updatedAt: new Date() })
          .where(eq(folders.id, squatted.id));
      }
      const created = await insertSystemFolder({ parentId: null, name, slug, systemKey: slug });
      if (created) return created;
    }
    throw conflict(`Could not create ${name} folder`);
  }

  async function uniqueSystemSlug(
    parentId: string,
    baseSlug: string,
    systemKey: string,
    stableSuffix = systemKey.split(":").at(-1) ?? systemKey,
  ) {
    const existingSystem = await db
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.kind, "skill"), eq(folders.systemKey, systemKey)))
      .then((rows) => rows[0] ?? null);
    if (existingSystem) return { id: existingSystem.id, slug: null };
    return {
      id: null,
      slug: await uniqueSiblingSlug(parentId, baseSlug, stableSuffix),
    };
  }

  async function ensureMyFolder(userId: string, userName: string | null, requestedSlug?: string | null): Promise<Folder> {
    if (!mutationLockHeld) {
      return withCompanyFolderLock((lockedDb) => folderService(lockedDb, true).ensureMyFolder(userId, userName, requestedSlug));
    }
    const parent = await ensureContainer("my", "My Skills");
    const systemKey = `my:${userId}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const resolved = await uniqueSystemSlug(parent.id, requestedSlug ?? normalizeFolderSlug(userName ?? userId), systemKey);
      if (resolved.id) return (await getFolder(resolved.id))!;
      const created = await insertSystemFolder({
        parentId: parent.id,
        name: userName?.trim() || "My Skills",
        slug: resolved.slug!,
        systemKey,
      });
      if (created) return created;
    }
    throw conflict("Could not create personal skill folder");
  }

  async function ensureProjectFolder(projectId: string, projectName: string): Promise<Folder> {
    if (!mutationLockHeld) {
      return withCompanyFolderLock((lockedDb) => folderService(lockedDb, true).ensureProjectFolder(projectId, projectName));
    }
    const parent = await ensureContainer("projects", "Projects");
    const systemKey = `project:${projectId}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const resolved = await uniqueSystemSlug(parent.id, normalizeFolderSlug(projectName), systemKey);
      if (resolved.id) return (await getFolder(resolved.id))!;
      const created = await insertSystemFolder({
        parentId: parent.id,
        name: projectName,
        slug: resolved.slug!,
        systemKey,
      });
      if (created) return created;
    }
    throw conflict("Could not create project skill folder");
  }

  async function ensureBundledCategory(category: string): Promise<Folder> {
    if (!mutationLockHeld) {
      return withCompanyFolderLock((lockedDb) => folderService(lockedDb, true).ensureBundledCategory(category));
    }
    const root = await ensureContainer("bundled", "Bundled");
    const name = normalizeName(category);
    const slug = normalizeFolderSlug(category);
    const systemKey = `bundled:${slug}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const resolved = await uniqueSystemSlug(root.id, slug, systemKey, "bundled");
      if (resolved.id) {
        const existing = await getFolder(resolved.id);
        if (!existing) continue;
        if (existing.name === name) return existing;
        await db
          .update(folders)
          .set({ name, updatedAt: new Date() })
          .where(eq(folders.id, existing.id));
        return (await getFolder(existing.id))!;
      }
      const created = await insertSystemFolder({
        parentId: root.id,
        name,
        slug: resolved.slug!,
        systemKey,
      });
      if (created) return created;
    }
    throw conflict("Could not create bundled skill folder");
  }

  async function pruneEmptyBundledCategories(retainedCategories: string[]): Promise<void> {
    if (!mutationLockHeld) {
      return withCompanyFolderLock((lockedDb) => folderService(lockedDb, true).pruneEmptyBundledCategories(retainedCategories));
    }
    const root = await findSystemFolder("bundled");
    if (!root) return;
    const rows = await getRows("skill");
    const retainedSystemKeys = new Set(
      retainedCategories.map((category) => `bundled:${normalizeFolderSlug(category)}`),
    );
    const usedFolderIds = new Set(
      await db
        .select({ folderId: companySkills.folderId })
        .from(companySkills)
        .then((skills) => skills.flatMap((skill) => skill.folderId ? [skill.folderId] : [])),
    );
    const parentIds = new Set(rows.flatMap((row) => row.parentId ? [row.parentId] : []));
    for (const row of rows) {
      if (row.parentId !== root.id || !row.systemKey?.startsWith("bundled:")) continue;
      if (retainedSystemKeys.has(row.systemKey) || usedFolderIds.has(row.id) || parentIds.has(row.id)) continue;
      await db.delete(folders).where(eq(folders.id, row.id));
    }
  }

  return {
    list,
    create,
    update,
    moveFolder,
    deleteFolder,
    moveItem,
    getFolder,
    descendantIds,
    validateSkillFolder,
    ensureMyFolder,
    ensureProjectFolder,
    ensureBundledCategory,
    pruneEmptyBundledCategories,
  };
}
