import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { getDb, getRaw, newId, nowIso } from "./db";
import * as s from "./db/schema";
import { seed } from "./db/seed";
import { can, requirePerm, type SessionUser } from "./auth";

export const ORG_ID = "org-001";
export const ACTIVE_BORROWING_STATUSES = [
  "submitted", "pending_approval", "approved", "ready_for_pickup", "borrowed", "partially_returned",
] as const;

let seeded = false;
export function ensureSeed() {
  if (seeded) return;
  seeded = true;
  try {
    seed();
  } catch {
    // seed() is idempotent-guarded; ignore races on first boot.
  }
}

// ---------- audit & notifications (PRD §5.16, §5.11) ----------
export function audit(actorId: string | null, action: string, entityType: string, entityId: string, before?: unknown, after?: unknown) {
  const db = getDb();
  db.insert(s.auditLogs).values({
    id: newId(), organizationId: ORG_ID, actorId, action, entityType, entityId,
    beforeData: before ? JSON.stringify(before) : null,
    afterData: after ? JSON.stringify(after) : null,
    createdAt: nowIso(),
  }).run();
}

export function notify(recipientId: string, eventKey: string, title: string, body: string) {
  const db = getDb();
  db.insert(s.notifications).values({
    id: newId(), recipientId, eventKey, title, body, locale: "id-ID", readAt: null, createdAt: nowIso(),
  }).run();
}

function requestNumber(db: ReturnType<typeof getDb>): string {
  const count = db.select({ n: sql<number>`count(*)` }).from(s.borrowings).get()?.n ?? 0;
  return `BRW-2026-${String(count + 1).padStart(6, "0")}`;
}

// ---------- assets (PRD §5.3, §5.4) ----------
export type AssetFilter = { q?: string; status?: string; categoryId?: string };

export function listAssets(f: AssetFilter = {}) {
  ensureSeed();
  const db = getDb();
  const rows = db.select().from(s.assets).orderBy(s.assets.assetCode).all();
  const cats = db.select().from(s.assetCategories).all();
  const locs = db.select().from(s.locations).all();
  const catById = new Map(cats.map((c) => [c.id, c]));
  const locById = new Map(locs.map((l) => [l.id, l]));
  let out = rows.map((a) => ({
    ...a,
    categoryName: catById.get(a.categoryId ?? "")?.name ?? "—",
    locationName: locById.get(a.locationId ?? "")?.name ?? "—",
  }));
  if (f.q) {
    const q = f.q.toLowerCase();
    out = out.filter((a) => [a.name, a.assetCode, a.serialNumber ?? "", a.brand ?? "", a.model ?? ""].join(" ").toLowerCase().includes(q));
  }
  if (f.status) out = out.filter((a) => a.status === f.status);
  if (f.categoryId) out = out.filter((a) => a.categoryId === f.categoryId);
  return { assets: out, categories: cats, locations: locs };
}

export function getAsset(id: string) {
  ensureSeed();
  const db = getDb();
  const asset = db.select().from(s.assets).where(eq(s.assets.id, id)).get();
  if (!asset) return null;
  const history = db.select().from(s.assetStatusHistory).where(eq(s.assetStatusHistory.assetId, id)).orderBy(desc(s.assetStatusHistory.createdAt)).all();
  const category = asset.categoryId ? db.select().from(s.assetCategories).where(eq(s.assetCategories.id, asset.categoryId)).get() : undefined;
  const location = asset.locationId ? db.select().from(s.locations).where(eq(s.locations.id, asset.locationId)).get() : undefined;
  return { asset, history, category, location };
}

/** Outstanding (not yet returned) quantity of an asset across active borrowings. */
export function outstandingQty(assetId: string, excludeBorrowingId?: string): number {
  const db = getDb();
  const items = db
    .select()
    .from(s.borrowingItems)
    .innerJoin(s.borrowings, eq(s.borrowingItems.borrowingId, s.borrowings.id))
    .where(and(eq(s.borrowingItems.assetId, assetId), inArray(s.borrowings.status, [...ACTIVE_BORROWING_STATUSES])))
    .all();
  return items.reduce((sum, r) => {
    if (excludeBorrowingId && r.borrowings.id === excludeBorrowingId) return sum;
    return sum + (r.borrowing_items.quantity - r.borrowing_items.returnedQuantity);
  }, 0);
}

/** PRD §7.3 / §11.4 — server-side availability. Serialized: no overlapping
 *  active borrowing. Quantity-based: requested + outstanding <= total. */
export function checkAvailability(assetId: string, startAt: string, dueAt: string, quantity: number, excludeBorrowingId?: string): { ok: boolean; reason?: string } {
  const db = getDb();
  const asset = db.select().from(s.assets).where(eq(s.assets.id, assetId)).get();
  if (!asset) return { ok: false, reason: "Asset tidak ditemukan / Asset not found" };
  if (asset.archivedAt) return { ok: false, reason: "Asset sudah diarsipkan / Asset is archived" };
  if (["maintenance", "damaged", "lost", "retired", "inactive"].includes(asset.status)) {
    return { ok: false, reason: `Asset berstatus ${asset.status} dan tidak dapat dipinjam` };
  }
  if (new Date(dueAt).getTime() <= new Date(startAt).getTime()) {
    return { ok: false, reason: "Tanggal kembali harus setelah tanggal mulai / Due date must be after start date" };
  }
  const outstanding = outstandingQty(assetId, excludeBorrowingId);
  if (asset.assetType === "serialized") {
    if (outstanding > 0) return { ok: false, reason: "Asset sedang dipinjam / Asset is currently borrowed (double booking dicegah)" };
  } else if (outstanding + quantity > asset.quantityTotal) {
    return { ok: false, reason: `Stok tidak cukup: tersedia ${asset.quantityTotal - outstanding} dari ${asset.quantityTotal}` };
  }
  return { ok: true };
}

export function createAsset(user: SessionUser, input: {
  assetCode: string; name: string; categoryId?: string; assetType: string;
  serialNumber?: string; brand?: string; model?: string; description?: string;
  locationId?: string; quantityTotal?: number;
}) {
  requirePerm(user, "assets.create");
  ensureSeed();
  const db = getDb();
  const dup = db.select().from(s.assets).where(eq(s.assets.assetCode, input.assetCode)).get();
  if (dup) throw Object.assign(new Error(`Kode aset ${input.assetCode} sudah dipakai / Asset code already exists`), { status: 409 });
  const id = newId();
  const now = nowIso();
  db.insert(s.assets).values({
    id, organizationId: ORG_ID, assetCode: input.assetCode, categoryId: input.categoryId ?? null,
    name: input.name, assetType: input.assetType, serialNumber: input.serialNumber ?? null,
    brand: input.brand ?? null, model: input.model ?? null, description: input.description ?? null,
    condition: "good", status: "available", locationId: input.locationId ?? null, custodianId: null,
    quantityTotal: input.assetType === "quantity" ? Math.max(1, input.quantityTotal ?? 1) : 1,
    acquiredAt: null, createdAt: now, updatedAt: now, archivedAt: null,
  }).run();
  audit(user.id, "asset.created", "asset", id, null, { assetCode: input.assetCode, name: input.name });
  return id;
}

export function updateAsset(user: SessionUser, id: string, patch: Partial<{ name: string; condition: string; status: string; locationId: string; description: string }>) {
  requirePerm(user, "assets.update");
  const db = getDb();
  const before = db.select().from(s.assets).where(eq(s.assets.id, id)).get();
  if (!before) throw Object.assign(new Error("Asset tidak ditemukan"), { status: 404 });
  if (before.status === "borrowed" && patch.status === "retired") {
    throw Object.assign(new Error("Asset yang sedang dipinjam tidak dapat di-retire"), { status: 409 });
  }
  db.update(s.assets).set({ ...patch, updatedAt: nowIso() }).where(eq(s.assets.id, id)).run();
  if (patch.status && patch.status !== before.status) {
    db.insert(s.assetStatusHistory).values({ id: newId(), assetId: id, status: patch.status, actorId: user.id, note: null, createdAt: nowIso() }).run();
  }
  audit(user.id, "asset.updated", "asset", id, { status: before.status }, patch);
}

export function archiveAsset(user: SessionUser, id: string) {
  requirePerm(user, "assets.archive");
  const db = getDb();
  const asset = db.select().from(s.assets).where(eq(s.assets.id, id)).get();
  if (!asset) throw Object.assign(new Error("Asset tidak ditemukan"), { status: 404 });
  if (outstandingQty(id) > 0 || asset.status === "borrowed") {
    throw Object.assign(new Error("Asset yang sedang dipinjam tidak dapat diarsipkan"), { status: 409 });
  }
  db.update(s.assets).set({ archivedAt: nowIso(), status: "inactive", updatedAt: nowIso() }).where(eq(s.assets.id, id)).run();
  audit(user.id, "asset.archived", "asset", id, { status: asset.status }, { status: "inactive" });
}

// ---------- borrowings (PRD §5.5, §7.1) ----------
export function listBorrowings(user: SessionUser, opts: { status?: string; mine?: boolean } = {}) {
  ensureSeed();
  const db = getDb();
  let rows = db.select().from(s.borrowings).orderBy(desc(s.borrowings.createdAt)).all();
  if (opts.mine || (!can(user, "borrowings.read_scope") && can(user, "borrowings.read_own"))) {
    rows = rows.filter((b) => b.borrowerId === user.id);
  }
  if (opts.status) rows = rows.filter((b) => b.status === opts.status);
  const users = db.select().from(s.users).all();
  const userById = new Map(users.map((u) => [u.id, u]));
  return rows.map((b) => ({ ...b, borrowerName: userById.get(b.borrowerId)?.fullName ?? b.borrowerId, overdue: ["borrowed", "partially_returned"].includes(b.status) && new Date(b.dueAt) < new Date() }));
}

export function getBorrowing(id: string) {
  ensureSeed();
  const db = getDb();
  const b = db.select().from(s.borrowings).where(eq(s.borrowings.id, id)).get();
  if (!b) return null;
  const items = db.select().from(s.borrowingItems).where(eq(s.borrowingItems.borrowingId, id)).all();
  const assets = db.select().from(s.assets).all();
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const history = db.select().from(s.borrowingStatusHistory).where(eq(s.borrowingStatusHistory.borrowingId, id)).orderBy(s.borrowingStatusHistory.createdAt).all();
  const borrower = db.select().from(s.users).where(eq(s.users.id, b.borrowerId)).get();
  const instances = db.select().from(s.approvalInstances).where(eq(s.approvalInstances.entityId, id)).all();
  const tasks = instances.length
    ? db.select().from(s.approvalTasks).where(inArray(s.approvalTasks.instanceId, instances.map((i) => i.id))).all()
    : [];
  const reminders = db.select().from(s.reminderInstances).where(eq(s.reminderInstances.borrowingId, id)).orderBy(s.reminderInstances.scheduledAt).all();
  return {
    borrowing: b, borrower,
    items: items.map((i) => ({ ...i, asset: assetById.get(i.assetId) })),
    history, instances, tasks, reminders,
    overdue: ["borrowed", "partially_returned"].includes(b.status) && new Date(b.dueAt) < new Date(),
  };
}

function setBorrowingStatus(db: ReturnType<typeof getDb>, id: string, status: string, actorId: string, note?: string) {
  db.update(s.borrowings).set({ status, updatedAt: nowIso() }).where(eq(s.borrowings.id, id)).run();
  db.insert(s.borrowingStatusHistory).values({ id: newId(), borrowingId: id, status, actorId, note: note ?? null, createdAt: nowIso() }).run();
}

export function createBorrowing(user: SessionUser, input: { purpose: string; startAt: string; dueAt: string; items: { assetId: string; quantity: number }[] }) {
  requirePerm(user, "borrowings.create");
  if (!input.items?.length) throw Object.assign(new Error("Minimal satu aset harus dipilih"), { status: 400 });
  if (new Date(input.dueAt).getTime() <= new Date(input.startAt).getTime()) {
    throw Object.assign(new Error("Tanggal kembali harus setelah tanggal mulai"), { status: 400 });
  }
  for (const it of input.items) {
    const chk = checkAvailability(it.assetId, input.startAt, input.dueAt, it.quantity);
    if (!chk.ok) throw Object.assign(new Error(chk.reason ?? "Aset tidak tersedia"), { status: 409 });
  }
  const db = getDb();
  const id = newId();
  const num = requestNumber(db);
  const now = nowIso();
  db.insert(s.borrowings).values({
    id, organizationId: ORG_ID, requestNumber: num, borrowerId: user.id, purpose: input.purpose,
    startAt: input.startAt, dueAt: input.dueAt, status: "draft", submittedAt: null, createdAt: now, updatedAt: now,
  }).run();
  for (const it of input.items) {
    db.insert(s.borrowingItems).values({ id: newId(), borrowingId: id, assetId: it.assetId, quantity: it.quantity, returnedQuantity: 0, conditionOut: null, notes: null }).run();
  }
  setBorrowingStatus(db, id, "draft", user.id, "Draft dibuat");
  audit(user.id, "borrowing.created", "borrowing", id, null, { requestNumber: num, purpose: input.purpose });
  return id;
}

function scheduleReminders(db: ReturnType<typeof getDb>, borrowingId: string, dueAt: string) {
  // Cancel stale scheduled reminders, then (re)create H-3 / H-1 / H / H+1.
  db.update(s.reminderInstances).set({ status: "cancelled" }).where(and(eq(s.reminderInstances.borrowingId, borrowingId), eq(s.reminderInstances.status, "scheduled"))).run();
  const rules = db.select().from(s.reminderRules).where(eq(s.reminderRules.isActive, true)).all();
  const due = new Date(dueAt).getTime();
  for (const r of rules) {
    const scheduled = new Date(due + r.offsetMinutes * 60 * 1000).toISOString();
    db.insert(s.reminderInstances).values({
      id: newId(), borrowingId, ruleId: r.id, scheduledAt: scheduled, status: "scheduled",
      idempotencyKey: `${borrowingId}:${r.id}:${scheduled}`, processedAt: null, createdAt: nowIso(),
    }).run();
  }
}

export function submitBorrowing(user: SessionUser, id: string) {
  requirePerm(user, "borrowings.submit");
  const db = getDb();
  const b = db.select().from(s.borrowings).where(eq(s.borrowings.id, id)).get();
  if (!b) throw Object.assign(new Error("Peminjaman tidak ditemukan"), { status: 404 });
  if (b.borrowerId !== user.id && !can(user, "borrowings.read_scope")) throw Object.assign(new Error("Bukan peminjaman Anda"), { status: 403 });
  if (b.status !== "draft") throw Object.assign(new Error(`Hanya draft yang bisa disubmit (status: ${b.status})`), { status: 409 });
  // Re-validate availability at submit time (PRD §5.5).
  const items = db.select().from(s.borrowingItems).where(eq(s.borrowingItems.borrowingId, id)).all();
  for (const it of items) {
    const chk = checkAvailability(it.assetId, b.startAt, b.dueAt, it.quantity, id);
    if (!chk.ok) throw Object.assign(new Error(chk.reason ?? "Aset tidak tersedia"), { status: 409 });
  }
  // Approval workflow: department manager of the borrower (PRD §5.6, default policy §28).
  const borrower = db.select().from(s.users).where(eq(s.users.id, b.borrowerId)).get();
  const approverId = borrower?.managerId ?? db.select().from(s.users).where(eq(s.users.role, "approver")).get()?.id;
  if (!approverId) throw Object.assign(new Error("Tidak ada approver yang dikonfigurasi"), { status: 500 });
  const instanceId = newId();
  db.insert(s.approvalInstances).values({
    id: instanceId, workflowName: "Department Manager Approval", entityType: "borrowing", entityId: id,
    snapshot: JSON.stringify({ borrowerId: b.borrowerId, requestNumber: b.requestNumber, purpose: b.purpose }),
    status: "pending", startedAt: nowIso(), completedAt: null,
  }).run();
  db.insert(s.approvalTasks).values({
    id: newId(), instanceId, stepOrder: 1, assignedTo: approverId, status: "pending", comments: null, createdAt: nowIso(), completedAt: null,
  }).run();
  db.update(s.borrowings).set({ submittedAt: nowIso() }).where(eq(s.borrowings.id, id)).run();
  setBorrowingStatus(db, id, "pending_approval", user.id, "Disubmit untuk approval");
  audit(user.id, "borrowing.submitted", "borrowing", id, { status: "draft" }, { status: "pending_approval" });
  notify(approverId, "approval.requested", "Permintaan approval baru", `Peminjaman ${b.requestNumber} menunggu persetujuan Anda.`);
  return instanceId;
}

export function cancelBorrowing(user: SessionUser, id: string) {
  const db = getDb();
  const b = db.select().from(s.borrowings).where(eq(s.borrowings.id, id)).get();
  if (!b) throw Object.assign(new Error("Peminjaman tidak ditemukan"), { status: 404 });
  if (b.borrowerId !== user.id && !can(user, "borrowings.read_scope")) throw Object.assign(new Error("Bukan peminjaman Anda"), { status: 403 });
  if (!["draft", "submitted", "pending_approval"].includes(b.status)) throw Object.assign(new Error(`Status ${b.status} tidak dapat dibatalkan`), { status: 409 });
  setBorrowingStatus(db, id, "cancelled", user.id, "Dibatalkan peminjam");
  db.update(s.approvalInstances).set({ status: "rejected" }).where(and(eq(s.approvalInstances.entityId, id), eq(s.approvalInstances.status, "pending"))).run();
  audit(user.id, "borrowing.cancelled", "borrowing", id, { status: b.status }, { status: "cancelled" });
}

// ---------- approvals (PRD §5.6) ----------
export function approvalInbox(user: SessionUser) {
  ensureSeed();
  const db = getDb();
  const tasks = db.select().from(s.approvalTasks).where(eq(s.approvalTasks.assignedTo, user.id)).orderBy(desc(s.approvalTasks.createdAt)).all();
  const instances = db.select().from(s.approvalInstances).all();
  const instById = new Map(instances.map((i) => [i.id, i]));
  const borrowings = db.select().from(s.borrowings).all();
  const borById = new Map(borrowings.map((b) => [b.id, b]));
  const users = db.select().from(s.users).all();
  const userById = new Map(users.map((u) => [u.id, u]));
  return tasks.map((t) => {
    const inst = instById.get(t.instanceId)!;
    const bor = inst.entityType === "borrowing" ? borById.get(inst.entityId) : undefined;
    return {
      ...t, instance: inst,
      requestNumber: bor?.requestNumber ?? inst.entityId,
      purpose: bor?.purpose ?? (inst.snapshot ? JSON.parse(inst.snapshot).purpose ?? "" : ""),
      borrowerName: bor ? userById.get(bor.borrowerId)?.fullName : undefined,
      borrowingStatus: bor?.status,
      extension: inst.entityType === "extension" && inst.snapshot ? JSON.parse(inst.snapshot) : null,
    };
  });
}

export function decideApproval(user: SessionUser, taskId: string, action: "approve" | "reject", comments?: string) {
  if (action === "reject" && !comments?.trim()) {
    throw Object.assign(new Error("Alasan penolakan wajib diisi / Rejection reason is required"), { status: 400 });
  }
  const db = getDb();
  const task = db.select().from(s.approvalTasks).where(eq(s.approvalTasks.id, taskId)).get();
  if (!task) throw Object.assign(new Error("Approval task tidak ditemukan"), { status: 404 });
  if (task.assignedTo !== user.id && user.role !== "admin") throw Object.assign(new Error("Anda bukan approver tugas ini"), { status: 403 });
  if (task.status !== "pending") throw Object.assign(new Error(`Tugas sudah ${task.status}`), { status: 409 });
  const inst = db.select().from(s.approvalInstances).where(eq(s.approvalInstances.id, task.instanceId)).get()!;
  // Separation of duties — PRD §4.2 / §5.6: requester cannot approve own request.
  const snap = inst.snapshot ? JSON.parse(inst.snapshot) : {};
  const borrowerId = snap.borrowerId as string | undefined;
  if (borrowerId && borrowerId === user.id) {
    throw Object.assign(new Error("Self-approval diblokir: peminjam tidak boleh menyetujui permintaannya sendiri"), { status: 403 });
  }
  const now = nowIso();
  db.update(s.approvalTasks).set({ status: action === "approve" ? "approved" : "rejected", comments: comments ?? null, completedAt: now }).where(eq(s.approvalTasks.id, taskId)).run();
  db.insert(s.approvalActions).values({ id: newId(), taskId, actorId: user.id, action, comments: comments ?? null, actedAt: now }).run();

  if (inst.entityType === "borrowing") {
    const b = db.select().from(s.borrowings).where(eq(s.borrowings.id, inst.entityId)).get();
    if (b) {
      if (action === "approve") {
        db.update(s.approvalInstances).set({ status: "approved", completedAt: now }).where(eq(s.approvalInstances.id, inst.id)).run();
        setBorrowingStatus(db, b.id, "approved", user.id, comments ?? "Disetujui");
        // Ready for pickup is the next operational state.
        setBorrowingStatus(db, b.id, "ready_for_pickup", user.id, "Siap diambil");
        audit(user.id, "approval.approved", "borrowing", b.id, { status: "pending_approval" }, { status: "ready_for_pickup" });
        notify(b.borrowerId, "borrowing.approved", "Peminjaman disetujui", `Peminjaman ${b.requestNumber} disetujui dan siap diambil.`);
      } else {
        db.update(s.approvalInstances).set({ status: "rejected", completedAt: now }).where(eq(s.approvalInstances.id, inst.id)).run();
        setBorrowingStatus(db, b.id, "rejected", user.id, comments);
        audit(user.id, "approval.rejected", "borrowing", b.id, { status: "pending_approval" }, { status: "rejected" });
        notify(b.borrowerId, "borrowing.rejected", "Peminjaman ditolak", `Peminjaman ${b.requestNumber} ditolak: ${comments}`);
      }
    }
  } else if (inst.entityType === "extension") {
    const b = db.select().from(s.borrowings).where(eq(s.borrowings.id, inst.entityId)).get();
    if (b && action === "approve") {
      const newDue = snap.newDueAt as string;
      db.update(s.approvalInstances).set({ status: "approved", completedAt: now }).where(eq(s.approvalInstances.id, inst.id)).run();
      const before = b.dueAt;
      db.update(s.borrowings).set({ dueAt: newDue, updatedAt: now }).where(eq(s.borrowings.id, b.id)).run();
      scheduleReminders(db, b.id, newDue); // PRD §5.9: reminder dijadwalkan ulang.
      audit(user.id, "borrowing.extended", "borrowing", b.id, { dueAt: before }, { dueAt: newDue });
      notify(b.borrowerId, "borrowing.extended", "Perpanjangan disetujui", `Peminjaman ${b.requestNumber} diperpanjang sampai ${newDue.slice(0, 10)}.`);
    } else if (b) {
      db.update(s.approvalInstances).set({ status: "rejected", completedAt: now }).where(eq(s.approvalInstances.id, inst.id)).run();
      notify(b.borrowerId, "borrowing.extension_rejected", "Perpanjangan ditolak", `Perpanjangan ${b.requestNumber} ditolak: ${comments}`);
    }
  }
  return { taskId, action };
}

// ---------- checkout & return (PRD §5.7, §5.8) ----------
export function checkoutBorrowing(user: SessionUser, id: string) {
  requirePerm(user, "borrowings.checkout");
  const db = getDb();
  const b = db.select().from(s.borrowings).where(eq(s.borrowings.id, id)).get();
  if (!b) throw Object.assign(new Error("Peminjaman tidak ditemukan"), { status: 404 });
  if (!["approved", "ready_for_pickup"].includes(b.status)) {
    throw Object.assign(new Error(`Checkout hanya setelah approval (status: ${b.status})`), { status: 409 });
  }
  // Atomic checkout: re-validate availability inside a transaction (PRD §11.4).
  getRaw().transaction(() => {
    const items = db.select().from(s.borrowingItems).where(eq(s.borrowingItems.borrowingId, id)).all();
    for (const it of items) {
      const chk = checkAvailability(it.assetId, b.startAt, b.dueAt, it.quantity, id);
      if (!chk.ok) throw Object.assign(new Error(chk.reason ?? "Aset tidak tersedia"), { status: 409 });
    }
    for (const it of items) {
      const asset = db.select().from(s.assets).where(eq(s.assets.id, it.assetId)).get()!;
      if (asset.assetType === "serialized") {
        db.update(s.assets).set({ status: "borrowed", updatedAt: nowIso() }).where(eq(s.assets.id, it.assetId)).run();
        db.insert(s.assetStatusHistory).values({ id: newId(), assetId: it.assetId, status: "borrowed", actorId: user.id, note: `Checkout ${b.requestNumber}`, createdAt: nowIso() }).run();
      }
      db.update(s.borrowingItems).set({ conditionOut: "good" }).where(eq(s.borrowingItems.id, it.id)).run();
    }
    setBorrowingStatus(db, id, "borrowed", user.id, `Checkout oleh ${user.fullName}`);
    scheduleReminders(db, id, b.dueAt);
  })();
  audit(user.id, "borrowing.checked_out", "borrowing", id, { status: "ready_for_pickup" }, { status: "borrowed" });
  notify(b.borrowerId, "borrowing.checked_out", "Aset sudah diambil", `Peminjaman ${b.requestNumber} sudah di-checkout. Kembalikan sebelum ${b.dueAt.slice(0, 10)}.`);
}

export function createReturn(user: SessionUser, borrowingId: string, items: { borrowingItemId: string; quantity: number; conditionIn: string; notes?: string }[]) {
  requirePerm(user, "returns.receive");
  const db = getDb();
  const b = db.select().from(s.borrowings).where(eq(s.borrowings.id, borrowingId)).get();
  if (!b) throw Object.assign(new Error("Peminjaman tidak ditemukan"), { status: 404 });
  if (!["borrowed", "partially_returned"].includes(b.status)) {
    throw Object.assign(new Error(`Status ${b.status} tidak bisa dikembalikan`), { status: 409 });
  }
  const validConditions = ["good", "minor_damage", "major_damage", "missing_component", "lost"];
  for (const it of items) {
    if (!validConditions.includes(it.conditionIn)) throw Object.assign(new Error(`Kondisi tidak valid: ${it.conditionIn}`), { status: 400 });
    const bi = db.select().from(s.borrowingItems).where(eq(s.borrowingItems.id, it.borrowingItemId)).get();
    if (!bi) throw Object.assign(new Error("Item peminjaman tidak ditemukan"), { status: 404 });
    const outstanding = bi.quantity - bi.returnedQuantity;
    if (it.quantity <= 0 || it.quantity > outstanding) {
      throw Object.assign(new Error(`Jumlah kembali tidak boleh melebihi sisa ${outstanding}`), { status: 400 });
    }
  }
  const returnId = newId();
  const returnCount = db.select({ n: sql<number>`count(*)` }).from(s.returns).get()?.n ?? 0;
  const retNum = `RTN-2026-${String(returnCount + 1).padStart(6, "0")}`;
  const now = nowIso();
  getRaw().transaction(() => {
    db.insert(s.returns).values({ id: returnId, organizationId: ORG_ID, borrowingId, returnNumber: retNum, receivedBy: user.id, returnedAt: now, status: "completed" }).run();
    let allReturned = true;
    for (const it of items) {
      db.insert(s.returnItems).values({ id: newId(), returnId, borrowingItemId: it.borrowingItemId, quantity: it.quantity, conditionIn: it.conditionIn, notes: it.notes ?? null }).run();
      const bi = db.select().from(s.borrowingItems).where(eq(s.borrowingItems.id, it.borrowingItemId)).get()!;
      db.update(s.borrowingItems).set({ returnedQuantity: bi.returnedQuantity + it.quantity }).where(eq(s.borrowingItems.id, it.borrowingItemId)).run();
      const asset = db.select().from(s.assets).where(eq(s.assets.id, bi.assetId)).get()!;
      const fullyReturned = bi.returnedQuantity + it.quantity >= bi.quantity;
      if (fullyReturned) {
        if (it.conditionIn === "good" || it.conditionIn === "minor_damage") {
          db.update(s.assets).set({ status: "available", condition: it.conditionIn === "minor_damage" ? "minor_damage" : asset.condition, updatedAt: now }).where(eq(s.assets.id, asset.id)).run();
        } else if (it.conditionIn === "lost") {
          db.update(s.assets).set({ status: "lost", condition: "lost", updatedAt: now }).where(eq(s.assets.id, asset.id)).run();
        } else {
          db.update(s.assets).set({ status: "damaged", condition: it.conditionIn, updatedAt: now }).where(eq(s.assets.id, asset.id)).run();
        }
        db.insert(s.assetStatusHistory).values({ id: newId(), assetId: asset.id, status: it.conditionIn === "good" || it.conditionIn === "minor_damage" ? "available" : it.conditionIn === "lost" ? "lost" : "damaged", actorId: user.id, note: `Return ${retNum} — kondisi: ${it.conditionIn}`, createdAt: now }).run();
      }
    }
    const remaining = db.select().from(s.borrowingItems).where(eq(s.borrowingItems.borrowingId, borrowingId)).all();
    allReturned = remaining.every((r) => r.returnedQuantity >= r.quantity);
    setBorrowingStatus(db, borrowingId, allReturned ? "returned" : "partially_returned", user.id, `Return ${retNum}`);
    if (allReturned) setBorrowingStatus(db, borrowingId, "closed", user.id, "Seluruh item kembali — ditutup");
  })();
  audit(user.id, "return.completed", "borrowing", borrowingId, { status: b.status }, { status: "closed" });
  notify(b.borrowerId, "return.completed", "Pengembalian dicatat", `Pengembalian ${retNum} untuk ${b.requestNumber} sudah dicatat.`);
  return returnId;
}

export function requestExtension(user: SessionUser, borrowingId: string, newDueAt: string, reason: string) {
  const db = getDb();
  const b = db.select().from(s.borrowings).where(eq(s.borrowings.id, borrowingId)).get();
  if (!b) throw Object.assign(new Error("Peminjaman tidak ditemukan"), { status: 404 });
  if (b.borrowerId !== user.id && user.role !== "admin") throw Object.assign(new Error("Bukan peminjaman Anda"), { status: 403 });
  if (!["borrowed", "partially_returned"].includes(b.status)) throw Object.assign(new Error(`Status ${b.status} tidak bisa diperpanjang`), { status: 409 });
  if (new Date(newDueAt).getTime() <= new Date(b.dueAt).getTime()) throw Object.assign(new Error("Tanggal baru harus setelah tanggal kembali saat ini"), { status: 400 });
  const items = db.select().from(s.borrowingItems).where(eq(s.borrowingItems.borrowingId, borrowingId)).all();
  for (const it of items) {
    const chk = checkAvailability(it.assetId, b.startAt, newDueAt, it.quantity, borrowingId);
    if (!chk.ok) throw Object.assign(new Error(`Konflik perpanjangan: ${chk.reason}`), { status: 409 });
  }
  const borrower = db.select().from(s.users).where(eq(s.users.id, b.borrowerId)).get();
  const approverId = borrower?.managerId ?? db.select().from(s.users).where(eq(s.users.role, "approver")).get()?.id;
  if (!approverId) throw Object.assign(new Error("Tidak ada approver"), { status: 500 });
  const instanceId = newId();
  db.insert(s.approvalInstances).values({
    id: instanceId, workflowName: "Extension Approval", entityType: "extension", entityId: borrowingId,
    snapshot: JSON.stringify({ borrowerId: b.borrowerId, requestNumber: b.requestNumber, purpose: b.purpose, oldDueAt: b.dueAt, newDueAt, reason }),
    status: "pending", startedAt: nowIso(), completedAt: null,
  }).run();
  db.insert(s.approvalTasks).values({ id: newId(), instanceId, stepOrder: 1, assignedTo: approverId, status: "pending", comments: null, createdAt: nowIso(), completedAt: null }).run();
  audit(user.id, "borrowing.extension_requested", "borrowing", borrowingId, { dueAt: b.dueAt }, { requestedDueAt: newDueAt, reason });
  notify(approverId, "extension.requested", "Permintaan perpanjangan", `Peminjaman ${b.requestNumber} diminta diperpanjang sampai ${newDueAt.slice(0, 10)}.`);
  return instanceId;
}

// ---------- reminders & notifications (PRD §5.10, §5.11) ----------
export function processDueReminders(): { sent: number; overdue: number } {
  ensureSeed();
  const db = getDb();
  const now = new Date();
  let sent = 0;
  const due = db.select().from(s.reminderInstances).where(eq(s.reminderInstances.status, "scheduled")).all()
    .filter((r) => new Date(r.scheduledAt).getTime() <= now.getTime());
  for (const r of due) {
    const b = db.select().from(s.borrowings).where(eq(s.borrowings.id, r.borrowingId)).get();
    if (!b || ["returned", "closed", "cancelled", "rejected"].includes(b.status)) {
      db.update(s.reminderInstances).set({ status: "cancelled" }).where(eq(s.reminderInstances.id, r.id)).run();
      continue;
    }
    const rule = db.select().from(s.reminderRules).where(eq(s.reminderRules.id, r.ruleId)).get();
    const label = rule?.offsetMinutes === 0 ? "hari ini" : rule && rule.offsetMinutes < 0 ? `H${rule.offsetMinutes / 1440}` : `H+${(rule?.offsetMinutes ?? 0) / 1440}`;
    notify(b.borrowerId, "reminder.due", `Pengingat peminjaman ${label}`, `Peminjaman ${b.requestNumber} jatuh tempo ${b.dueAt.slice(0, 10)}. Segera kembalikan aset.`);
    db.update(s.reminderInstances).set({ status: "sent", processedAt: nowIso() }).where(eq(s.reminderInstances.id, r.id)).run();
    sent++;
  }
  // Overdue escalation: notify the asset manager once per overdue borrowing per day (idempotent via event key + date).
  const overdue = listBorrowings({ id: "user-admin", role: "admin", fullName: "x", email: "x", organizationId: ORG_ID, employeeNo: "x", departmentId: null, managerId: null, preferredLocale: "id-ID", status: "active", createdAt: "", updatedAt: "" } as SessionUser)
    .filter((b) => b.overdue);
  const manager = db.select().from(s.users).where(eq(s.users.role, "asset_manager")).get();
  for (const b of overdue) {
    const key = `overdue:${b.id}:${now.toISOString().slice(0, 10)}`;
    const exists = db.select().from(s.notifications).where(eq(s.notifications.eventKey, key)).get();
    if (!exists && manager) {
      notify(manager.id, key, "Eskalasi: peminjaman terlambat", `Peminjaman ${b.requestNumber} (${b.borrowerName}) terlambat sejak ${b.dueAt.slice(0, 10)}.`);
    }
  }
  return { sent, overdue: overdue.length };
}

export function listNotifications(user: SessionUser) {
  ensureSeed();
  const db = getDb();
  return db.select().from(s.notifications).where(eq(s.notifications.recipientId, user.id)).orderBy(desc(s.notifications.createdAt)).all();
}

export function unreadCount(user: SessionUser): number {
  const db = getDb();
  return db.select({ n: sql<number>`count(*)` }).from(s.notifications).where(and(eq(s.notifications.recipientId, user.id), sql`read_at IS NULL`)).get()?.n ?? 0;
}

export function markNotificationRead(user: SessionUser, id: string) {
  const db = getDb();
  db.update(s.notifications).set({ readAt: nowIso() }).where(and(eq(s.notifications.id, id), eq(s.notifications.recipientId, user.id))).run();
}

// ---------- dashboard & reports (PRD §3.3, §5.15) ----------
export function dashboardKpis() {
  ensureSeed();
  const db = getDb();
  const assets = db.select().from(s.assets).all();
  const borrowings = db.select().from(s.borrowings).all();
  const today = new Date().toISOString().slice(0, 10);
  return {
    totalAssets: assets.length,
    available: assets.filter((a) => a.status === "available").length,
    borrowed: assets.filter((a) => a.status === "borrowed").length,
    maintenance: assets.filter((a) => a.status === "maintenance" || a.status === "damaged").length,
    pendingApprovals: borrowings.filter((b) => b.status === "pending_approval").length,
    dueToday: borrowings.filter((b) => ["borrowed", "partially_returned"].includes(b.status) && b.dueAt.slice(0, 10) === today).length,
    overdue: borrowings.filter((b) => ["borrowed", "partially_returned"].includes(b.status) && new Date(b.dueAt) < new Date()).length,
    activeBorrowings: borrowings.filter((b) => ACTIVE_BORROWING_STATUSES.includes(b.status as never)).length,
    totalBorrowings: borrowings.length,
    utilization: assets.length ? Math.round((assets.filter((a) => a.status === "borrowed").length / assets.length) * 100) : 0,
  };
}

export function listAudit(limit = 100) {
  ensureSeed();
  const db = getDb();
  const rows = db.select().from(s.auditLogs).orderBy(desc(s.auditLogs.createdAt)).all().slice(0, limit);
  const users = db.select().from(s.users).all();
  const userById = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({ ...r, actorName: r.actorId ? userById.get(r.actorId)?.fullName ?? r.actorId : "system" }));
}

export function listUsers() {
  ensureSeed();
  return getDb().select().from(s.users).orderBy(s.users.fullName).all();
}
