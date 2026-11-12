import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// PRD §11 — logical schema, adapted for SQLite in the local MVP.
// PostgreSQL types (UUID/TIMESTAMPTZ/JSONB) map to TEXT/INTEGER here;
// the table and column names follow the PRD so the upgrade path stays clear.

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Jakarta"),
  defaultLanguage: text("default_language").notNull().default("id-ID"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const branches = sqliteTable("branches", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  address: text("address"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const departments = sqliteTable("departments", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  branchId: text("branch_id"),
  parentId: text("parent_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  managerId: text("manager_id"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  branchId: text("branch_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  locationType: text("location_type").notNull().default("room"),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    employeeNo: text("employee_no").notNull(),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    // Role is stored on the user in the MVP (PRD uses roles/permissions tables;
    // the permission map lives in src/lib/auth.ts so it can be ported 1:1).
    role: text("role").notNull(), // admin | asset_manager | asset_officer | approver | employee
    departmentId: text("department_id"),
    managerId: text("manager_id"),
    preferredLocale: text("preferred_locale").notNull().default("id-ID"),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

export const assetCategories = sqliteTable("asset_categories", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    assetCode: text("asset_code").notNull(),
    categoryId: text("category_id"),
    name: text("name").notNull(),
    assetType: text("asset_type").notNull().default("serialized"), // serialized | quantity
    serialNumber: text("serial_number"),
    brand: text("brand"),
    model: text("model"),
    description: text("description"),
    condition: text("condition").notNull().default("good"), // good | minor_damage | major_damage | missing_component | lost
    status: text("status").notNull().default("available"), // available | reserved | borrowed | maintenance | damaged | lost | retired | inactive
    locationId: text("location_id"),
    custodianId: text("custodian_id"),
    quantityTotal: integer("quantity_total").notNull().default(1),
    acquiredAt: text("acquired_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (t) => [
    uniqueIndex("assets_code_idx").on(t.assetCode),
    index("assets_org_status_idx").on(t.organizationId, t.status),
  ]
);

export const assetStatusHistory = sqliteTable("asset_status_history", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull(),
  status: text("status").notNull(),
  actorId: text("actor_id"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const borrowings = sqliteTable(
  "borrowings",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    requestNumber: text("request_number").notNull(),
    borrowerId: text("borrower_id").notNull(),
    purpose: text("purpose").notNull(),
    startAt: text("start_at").notNull(),
    dueAt: text("due_at").notNull(),
    status: text("status").notNull().default("draft"),
    submittedAt: text("submitted_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("borrowings_number_idx").on(t.requestNumber),
    index("borrowings_org_status_idx").on(t.organizationId, t.status),
    index("borrowings_due_idx").on(t.organizationId, t.dueAt),
  ]
);

export const borrowingItems = sqliteTable("borrowing_items", {
  id: text("id").primaryKey(),
  borrowingId: text("borrowing_id").notNull(),
  assetId: text("asset_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  returnedQuantity: integer("returned_quantity").notNull().default(0),
  conditionOut: text("condition_out"),
  notes: text("notes"),
});

export const borrowingStatusHistory = sqliteTable("borrowing_status_history", {
  id: text("id").primaryKey(),
  borrowingId: text("borrowing_id").notNull(),
  status: text("status").notNull(),
  actorId: text("actor_id"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const approvalInstances = sqliteTable("approval_instances", {
  id: text("id").primaryKey(),
  workflowName: text("workflow_name").notNull(),
  entityType: text("entity_type").notNull(), // borrowing | extension
  entityId: text("entity_id").notNull(),
  snapshot: text("snapshot"), // JSON
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
});

export const approvalTasks = sqliteTable("approval_tasks", {
  id: text("id").primaryKey(),
  instanceId: text("instance_id").notNull(),
  stepOrder: integer("step_order").notNull().default(1),
  assignedTo: text("assigned_to").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected | delegated
  comments: text("comments"),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});

export const approvalActions = sqliteTable("approval_actions", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(), // approve | reject | delegate
  comments: text("comments"),
  actedAt: text("acted_at").notNull(),
});

export const returns = sqliteTable(
  "returns",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    borrowingId: text("borrowing_id").notNull(),
    returnNumber: text("return_number").notNull(),
    receivedBy: text("received_by").notNull(),
    returnedAt: text("returned_at").notNull(),
    status: text("status").notNull().default("completed"),
  },
  (t) => [uniqueIndex("returns_number_idx").on(t.returnNumber)]
);

export const returnItems = sqliteTable("return_items", {
  id: text("id").primaryKey(),
  returnId: text("return_id").notNull(),
  borrowingItemId: text("borrowing_item_id").notNull(),
  quantity: integer("quantity").notNull(),
  conditionIn: text("condition_in").notNull(), // good | minor_damage | major_damage | missing_component | lost
  notes: text("notes"),
});

export const reminderRules = sqliteTable("reminder_rules", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  eventType: text("event_type").notNull(), // due_date
  offsetMinutes: integer("offset_minutes").notNull(),
  channel: text("channel").notNull().default("in_app"), // in_app | email
  recipientStrategy: text("recipient_strategy").notNull().default("borrower"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const reminderInstances = sqliteTable(
  "reminder_instances",
  {
    id: text("id").primaryKey(),
    borrowingId: text("borrowing_id").notNull(),
    ruleId: text("rule_id").notNull(),
    scheduledAt: text("scheduled_at").notNull(),
    status: text("status").notNull().default("scheduled"), // scheduled | sent | cancelled
    idempotencyKey: text("idempotency_key").notNull(),
    processedAt: text("processed_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("reminder_idem_idx").on(t.idempotencyKey)]
);

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  recipientId: text("recipient_id").notNull(),
  eventKey: text("event_key").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  locale: text("locale").notNull().default("id-ID"),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull(),
});

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    beforeData: text("before_data"),
    afterData: text("after_data"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("audit_org_created_idx").on(t.organizationId, t.createdAt)]
);

export type Asset = typeof assets.$inferSelect;
export type Borrowing = typeof borrowings.$inferSelect;
export type BorrowingItem = typeof borrowingItems.$inferSelect;
export type User = typeof users.$inferSelect;
export type ApprovalTask = typeof approvalTasks.$inferSelect;
