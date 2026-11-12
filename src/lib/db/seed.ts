import { eq } from "drizzle-orm";
import { getDb, newId, nowIso } from "./index";
import * as s from "./schema";

const ORG = "org-001";
const now = nowIso();

function seed() {
  const db = getDb();
  const existing = db.select().from(s.organizations).all();
  if (existing.length > 0) {
    console.log("Seed: database already has data, skipping.");
    return;
  }

  db.insert(s.organizations).values({
    id: ORG, code: "PTC", name: "PT Contoh", timezone: "Asia/Jakarta",
    defaultLanguage: "id-ID", isActive: true, createdAt: now, updatedAt: now,
  }).run();
  db.insert(s.branches).values([
    { id: "br-jkt", organizationId: ORG, code: "JKT", name: "Jakarta HQ", address: "Jl. Sudirman No. 1, Jakarta", isActive: true, createdAt: now, updatedAt: now },
    { id: "br-bdg", organizationId: ORG, code: "BDG", name: "Bandung", address: "Jl. Asia Afrika No. 10, Bandung", isActive: true, createdAt: now, updatedAt: now },
  ]).run();
  db.insert(s.departments).values([
    { id: "dept-it", organizationId: ORG, branchId: "br-jkt", code: "IT", name: "Teknologi Informasi", managerId: "user-approver", isActive: true, createdAt: now, updatedAt: now },
    { id: "dept-hr", organizationId: ORG, branchId: "br-jkt", code: "HR", name: "Human Resources", managerId: "user-approver", isActive: true, createdAt: now, updatedAt: now },
    { id: "dept-fin", organizationId: ORG, branchId: "br-jkt", code: "FIN", name: "Keuangan", managerId: "user-approver", isActive: true, createdAt: now, updatedAt: now },
  ]).run();
  db.insert(s.locations).values([
    { id: "loc-gudang", organizationId: ORG, branchId: "br-jkt", code: "GDG-A", name: "Gudang A", locationType: "storage", description: "Gudang aset lantai 1", isActive: true, createdAt: now, updatedAt: now },
    { id: "loc-meeting", organizationId: ORG, branchId: "br-jkt", code: "RMT-01", name: "Ruang Meeting 1", locationType: "room", description: "Ruang meeting lantai 2", isActive: true, createdAt: now, updatedAt: now },
    { id: "loc-it", organizationId: ORG, branchId: "br-jkt", code: "IT-01", name: "Ruang IT", locationType: "room", description: "Ruang kerja tim IT", isActive: true, createdAt: now, updatedAt: now },
  ]).run();

  // Demo users — one per role. Login is demo pick-a-user (no password in MVP).
  const users = [
    { id: "user-admin", employeeNo: "EMP-001", email: "admin@borrowflow.local", fullName: "Andi Admin", role: "admin", departmentId: "dept-it" },
    { id: "user-manager", employeeNo: "EMP-002", email: "manager@borrowflow.local", fullName: "Maya Manager", role: "asset_manager", departmentId: "dept-it" },
    { id: "user-officer", employeeNo: "EMP-003", email: "officer@borrowflow.local", fullName: "Oki Officer", role: "asset_officer", departmentId: "dept-it" },
    { id: "user-approver", employeeNo: "EMP-004", email: "approver@borrowflow.local", fullName: "Rani Approver", role: "approver", departmentId: "dept-it" },
    { id: "user-budi", employeeNo: "EMP-005", email: "budi@borrowflow.local", fullName: "Budi Karyawan", role: "employee", departmentId: "dept-it", managerId: "user-approver" },
    { id: "user-sari", employeeNo: "EMP-006", email: "sari@borrowflow.local", fullName: "Sari Karyawan", role: "employee", departmentId: "dept-hr", managerId: "user-approver" },
  ];
  for (const u of users) {
    db.insert(s.users).values({
      ...u, organizationId: ORG, managerId: u.managerId ?? null,
      preferredLocale: "id-ID", status: "active", createdAt: now, updatedAt: now,
    }).run();
  }

  const cats = [
    { id: "cat-laptop", code: "LAPTOP", name: "Laptop" },
    { id: "cat-proyektor", code: "PROYEKTOR", name: "Proyektor" },
    { id: "cat-kamera", code: "KAMERA", name: "Kamera" },
    { id: "cat-audio", code: "AUDIO", name: "Audio" },
    { id: "cat-aksesoris", code: "AKSESORIS", name: "Aksesoris & Kabel" },
    { id: "cat-monitor", code: "MONITOR", name: "Monitor" },
  ];
  for (const c of cats) {
    db.insert(s.assetCategories).values({ ...c, organizationId: ORG, createdAt: now, updatedAt: now }).run();
  }

  const assets = [
    { code: "AST-LTP-001", cat: "cat-laptop", name: "Laptop Dell XPS 13", type: "serialized", serial: "DLXPS13001", brand: "Dell", model: "XPS 13 9340", loc: "loc-gudang", qty: 1 },
    { code: "AST-LTP-002", cat: "cat-laptop", name: "Laptop Lenovo ThinkPad X1", type: "serialized", serial: "LNVX1002", brand: "Lenovo", model: "ThinkPad X1 Carbon", loc: "loc-gudang", qty: 1 },
    { code: "AST-LTP-003", cat: "cat-laptop", name: "Laptop MacBook Air M3", type: "serialized", serial: "APLMB3003", brand: "Apple", model: "MacBook Air M3", loc: "loc-gudang", qty: 1 },
    { code: "AST-PRJ-001", cat: "cat-proyektor", name: "Proyektor Epson EB-X51", type: "serialized", serial: "EPSX51001", brand: "Epson", model: "EB-X51", loc: "loc-meeting", qty: 1 },
    { code: "AST-PRJ-002", cat: "cat-proyektor", name: "Proyektor BenQ MH535", type: "serialized", serial: "BNQ535002", brand: "BenQ", model: "MH535", loc: "loc-meeting", qty: 1 },
    { code: "AST-KMR-001", cat: "cat-kamera", name: "Kamera Canon EOS R50", type: "serialized", serial: "CNR50001", brand: "Canon", model: "EOS R50", loc: "loc-gudang", qty: 1 },
    { code: "AST-KMR-002", cat: "cat-kamera", name: "Kamera Sony ZV-E10", type: "serialized", serial: "SNYZV1002", brand: "Sony", model: "ZV-E10", loc: "loc-gudang", qty: 1 },
    { code: "AST-AUD-001", cat: "cat-audio", name: "Speaker JBL PartyBox", type: "serialized", serial: "JBLPB001", brand: "JBL", model: "PartyBox 110", loc: "loc-meeting", qty: 1 },
    { code: "AST-KBL-001", cat: "cat-aksesoris", name: "Kabel HDMI 2m", type: "quantity", serial: null, brand: "Vention", model: "HDMI 2.0 2m", loc: "loc-gudang", qty: 10 },
    { code: "AST-KBL-002", cat: "cat-aksesoris", name: "Adaptor USB-C to HDMI", type: "quantity", serial: null, brand: "Ugreen", model: "USB-C Hub", loc: "loc-gudang", qty: 8 },
    { code: "AST-MON-001", cat: "cat-monitor", name: "Monitor LG 27\" 4K", type: "serialized", serial: "LGM27001", brand: "LG", model: "27UL500", loc: "loc-it", qty: 1 },
    { code: "AST-MON-002", cat: "cat-monitor", name: "Monitor Samsung 24\" FHD", type: "serialized", serial: "SMS24002", brand: "Samsung", model: "S24C310", loc: "loc-it", qty: 1 },
  ];
  for (const a of assets) {
    db.insert(s.assets).values({
      id: newId(), organizationId: ORG, assetCode: a.code, categoryId: a.cat,
      name: a.name, assetType: a.type, serialNumber: a.serial, brand: a.brand,
      model: a.model, description: `${a.name} — aset contoh Device Tracker.`,
      condition: "good", status: "available", locationId: a.loc,
      custodianId: null, quantityTotal: a.qty, acquiredAt: "2025-01-15",
      createdAt: now, updatedAt: now, archivedAt: null,
    }).run();
  }

  // Reminder rules — PRD §5.10: H-3, H-1, H, H+1 (offset in minutes).
  const rules = [
    { id: "rule-h-3", offset: -3 * 24 * 60 },
    { id: "rule-h-1", offset: -1 * 24 * 60 },
    { id: "rule-h0", offset: 0 },
    { id: "rule-h+1", offset: 1 * 24 * 60 },
  ];
  for (const r of rules) {
    db.insert(s.reminderRules).values({
      id: r.id, organizationId: ORG, eventType: "due_date",
      offsetMinutes: r.offset, channel: "in_app", recipientStrategy: "borrower",
      isActive: true, createdAt: now,
    }).run();
  }

  // Example borrowings: one borrowed (due in 2 days), one pending approval,
  // one returned/closed — so the dashboard, approvals and reports are not empty.
  const allAssets = db.select().from(s.assets).all();
  const byCode = (code: string) => allAssets.find((a) => a.assetCode === code)!;
  const day = 24 * 60 * 60 * 1000;
  const t0 = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();

  const mkBorrowing = (id: string, num: string, borrower: string, purpose: string, start: number, due: number, status: string, items: { assetId: string; qty: number }[]) => {
    db.insert(s.borrowings).values({
      id, organizationId: ORG, requestNumber: num, borrowerId: borrower, purpose,
      startAt: iso(start), dueAt: iso(due), status,
      submittedAt: status === "draft" ? null : iso(start - day),
      createdAt: iso(start - day), updatedAt: now,
    }).run();
    for (const it of items) {
      db.insert(s.borrowingItems).values({
        id: newId(), borrowingId: id, assetId: it.assetId, quantity: it.qty,
        returnedQuantity: status === "returned" || status === "closed" ? it.qty : 0,
        conditionOut: "good", notes: null,
      }).run();
    }
    db.insert(s.borrowingStatusHistory).values({
      id: newId(), borrowingId: id, status, actorId: borrower, note: "Seed", createdAt: now,
    }).run();
    return id;
  };

  // 1. Borrowed — Budi, laptop + kabel, due in 2 days.
  const b1 = mkBorrowing("brw-seed-1", "BRW-2026-000001", "user-budi", "Presentasi ke klien di luar kota", t0 - 2 * day, t0 + 2 * day, "borrowed", [
    { assetId: byCode("AST-LTP-001").id, qty: 1 },
    { assetId: byCode("AST-KBL-001").id, qty: 2 },
  ]);
  db.update(s.assets).set({ status: "borrowed" }).where(eq(s.assets.id, byCode("AST-LTP-001").id)).run();

  // 2. Pending approval — Sari, proyektor.
  const b2 = mkBorrowing("brw-seed-2", "BRW-2026-000002", "user-sari", "Pelatihan internal departemen HR", t0 + day, t0 + 3 * day, "pending_approval", [
    { assetId: byCode("AST-PRJ-001").id, qty: 1 },
  ]);
  db.insert(s.approvalInstances).values({
    id: "apr-seed-2", workflowName: "Department Manager Approval", entityType: "borrowing",
    entityId: b2, snapshot: JSON.stringify({ borrowerId: "user-sari", requestNumber: "BRW-2026-000002" }),
    status: "pending", startedAt: iso(t0 - day), completedAt: null,
  }).run();
  db.insert(s.approvalTasks).values({
    id: "task-seed-2", instanceId: "apr-seed-2", stepOrder: 1, assignedTo: "user-approver",
    status: "pending", comments: null, createdAt: iso(t0 - day), completedAt: null,
  }).run();

  // 3. Returned/closed — Budi, kamera.
  mkBorrowing("brw-seed-3", "BRW-2026-000003", "user-budi", "Dokumentasi acara perusahaan", t0 - 6 * day, t0 - 4 * day, "closed", [
    { assetId: byCode("AST-KMR-001").id, qty: 1 },
  ]);

  // Reminder instances for the borrowed item (idempotent keys).
  for (const r of rules) {
    const due = t0 + 2 * day;
    db.insert(s.reminderInstances).values({
      id: newId(), borrowingId: b1, ruleId: r.id,
      scheduledAt: iso(due + r.offset * 60 * 1000),
      status: "scheduled", idempotencyKey: `brw-seed-1:${r.id}`, processedAt: null, createdAt: now,
    }).run();
  }

  db.insert(s.auditLogs).values({
    id: newId(), organizationId: ORG, actorId: "system", action: "seed.completed",
    entityType: "organization", entityId: ORG,
    beforeData: null, afterData: JSON.stringify({ users: 6, assets: 12 }),
    createdAt: now,
  }).run();

  console.log("Seed complete: 1 org, 2 branches, 3 departments, 3 locations, 6 users, 12 assets, 3 borrowings.");
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("seed.ts")) {
  seed();
}

export { seed };
