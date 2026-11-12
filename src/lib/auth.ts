import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as s from "./db/schema";

// PRD §4.2 — permission catalogue. In the MVP the role -> permission map
// lives here (the full PRD uses roles/permissions tables); every API route
// and server action checks it server-side, never only in the UI.
export const ROLE_LABEL: Record<string, string> = {
  admin: "Admin Organisasi",
  asset_manager: "Asset Manager",
  asset_officer: "Asset Officer",
  approver: "Department Manager / Approver",
  employee: "Employee / Borrower",
};

const PERMS: Record<string, string[]> = {
  admin: ["*"],
  asset_manager: [
    "assets.read", "assets.create", "assets.update", "assets.archive",
    "borrowings.read_scope", "borrowings.checkout", "borrowings.extend",
    "approvals.read_inbox", "returns.receive", "returns.inspect",
    "reminders.manage", "reports.read", "reports.export", "audit.read",
    "users.manage", "settings.manage",
  ],
  asset_officer: [
    "assets.read", "borrowings.read_scope", "borrowings.checkout",
    "returns.receive", "returns.inspect", "reports.read",
  ],
  approver: [
    "assets.read", "borrowings.read_scope", "approvals.read_inbox",
    "approvals.approve", "approvals.reject", "reports.read",
  ],
  employee: [
    "assets.read", "borrowings.create", "borrowings.read_own",
    "borrowings.submit", "borrowings.cancel", "borrowings.extend",
    "reports.read",
  ],
};

export function can(user: { role: string }, perm: string): boolean {
  const list = PERMS[user.role] ?? [];
  return list.includes("*") || list.includes(perm);
}

export function requirePerm(user: { role: string }, perm: string): void {
  if (!can(user, perm)) {
    const err = new Error(`Forbidden: missing permission ${perm}`) as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}

export type SessionUser = typeof s.users.$inferSelect;

const COOKIE = "dt_session";

/** Demo auth (MVP): the session cookie holds a seeded user id.
 *  No password in the MVP — login is pick-a-demo-user. Replace with
 *  OIDC/Keycloak before any production use (PRD §5.1). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;
  const db = getDb();
  const rows = db.select().from(s.users).where(eq(s.users.id, id)).all();
  const user = rows[0] ?? null;
  if (user && user.status !== "active") return null;
  return user;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const err = new Error("Unauthorized") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return user;
}

export function sessionCookie(userId: string) {
  return {
    name: COOKIE,
    value: userId,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function clearSessionCookie() {
  return { name: COOKIE, value: "", httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 0 };
}

export function isOverdue(b: { status: string; dueAt: string }, now = new Date()): boolean {
  const outstanding = ["borrowed", "partially_returned"].includes(b.status);
  return outstanding && new Date(b.dueAt).getTime() < now.getTime();
}
