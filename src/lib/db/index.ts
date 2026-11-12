import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

let _db: Db | null = null;
let _raw: Database.Database | null = null;

export function dbPath(): string {
  return path.join(process.cwd(), "data", "borrowflow.db");
}

const DDL = `
CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta', default_language TEXT NOT NULL DEFAULT 'id-ID', is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS branches (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, address TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, branch_id TEXT, parent_id TEXT, code TEXT NOT NULL, name TEXT NOT NULL, manager_id TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS locations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, branch_id TEXT, code TEXT NOT NULL, name TEXT NOT NULL, location_type TEXT NOT NULL DEFAULT 'room', description TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, employee_no TEXT NOT NULL, email TEXT NOT NULL, full_name TEXT NOT NULL, role TEXT NOT NULL, department_id TEXT, manager_id TEXT, preferred_locale TEXT NOT NULL DEFAULT 'id-ID', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE TABLE IF NOT EXISTS asset_categories (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, description TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, asset_code TEXT NOT NULL, category_id TEXT, name TEXT NOT NULL, asset_type TEXT NOT NULL DEFAULT 'serialized', serial_number TEXT, brand TEXT, model TEXT, description TEXT, condition TEXT NOT NULL DEFAULT 'good', status TEXT NOT NULL DEFAULT 'available', location_id TEXT, custodian_id TEXT, quantity_total INTEGER NOT NULL DEFAULT 1, acquired_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS assets_code_idx ON assets(asset_code);
CREATE INDEX IF NOT EXISTS assets_org_status_idx ON assets(organization_id, status);
CREATE TABLE IF NOT EXISTS asset_status_history (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, status TEXT NOT NULL, actor_id TEXT, note TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS borrowings (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, request_number TEXT NOT NULL, borrower_id TEXT NOT NULL, purpose TEXT NOT NULL, start_at TEXT NOT NULL, due_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', submitted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS borrowings_number_idx ON borrowings(request_number);
CREATE INDEX IF NOT EXISTS borrowings_org_status_idx ON borrowings(organization_id, status);
CREATE INDEX IF NOT EXISTS borrowings_due_idx ON borrowings(organization_id, due_at);
CREATE TABLE IF NOT EXISTS borrowing_items (id TEXT PRIMARY KEY, borrowing_id TEXT NOT NULL, asset_id TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, returned_quantity INTEGER NOT NULL DEFAULT 0, condition_out TEXT, notes TEXT);
CREATE TABLE IF NOT EXISTS borrowing_status_history (id TEXT PRIMARY KEY, borrowing_id TEXT NOT NULL, status TEXT NOT NULL, actor_id TEXT, note TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS approval_instances (id TEXT PRIMARY KEY, workflow_name TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, snapshot TEXT, status TEXT NOT NULL DEFAULT 'pending', started_at TEXT NOT NULL, completed_at TEXT);
CREATE TABLE IF NOT EXISTS approval_tasks (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, step_order INTEGER NOT NULL DEFAULT 1, assigned_to TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', comments TEXT, created_at TEXT NOT NULL, completed_at TEXT);
CREATE TABLE IF NOT EXISTS approval_actions (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, actor_id TEXT NOT NULL, action TEXT NOT NULL, comments TEXT, acted_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS returns (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, borrowing_id TEXT NOT NULL, return_number TEXT NOT NULL, received_by TEXT NOT NULL, returned_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'completed');
CREATE UNIQUE INDEX IF NOT EXISTS returns_number_idx ON returns(return_number);
CREATE TABLE IF NOT EXISTS return_items (id TEXT PRIMARY KEY, return_id TEXT NOT NULL, borrowing_item_id TEXT NOT NULL, quantity INTEGER NOT NULL, condition_in TEXT NOT NULL, notes TEXT);
CREATE TABLE IF NOT EXISTS reminder_rules (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, event_type TEXT NOT NULL, offset_minutes INTEGER NOT NULL, channel TEXT NOT NULL DEFAULT 'in_app', recipient_strategy TEXT NOT NULL DEFAULT 'borrower', is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reminder_instances (id TEXT PRIMARY KEY, borrowing_id TEXT NOT NULL, rule_id TEXT NOT NULL, scheduled_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled', idempotency_key TEXT NOT NULL, processed_at TEXT, created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS reminder_idem_idx ON reminder_instances(idempotency_key);
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, recipient_id TEXT NOT NULL, event_key TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, locale TEXT NOT NULL DEFAULT 'id-ID', read_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, actor_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, before_data TEXT, after_data TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS audit_org_created_idx ON audit_logs(organization_id, created_at);
`;

export function getDb(): Db {
  if (_db) return _db;
  const dir = path.dirname(dbPath());
  fs.mkdirSync(dir, { recursive: true });
  _raw = new Database(dbPath());
  _raw.pragma("journal_mode = WAL");
  _raw.pragma("foreign_keys = ON");
  _raw.exec(DDL);
  _db = drizzle(_raw, { schema });
  return _db;
}

export function getRaw(): Database.Database {
  getDb();
  return _raw!;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}
