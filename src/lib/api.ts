import { NextResponse } from "next/server";
import { getCurrentUser, requirePerm, type SessionUser } from "@/lib/auth";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(
    { data, meta: { requestId: `req-${Date.now()}`, timestamp: new Date().toISOString() } },
    { status }
  );
}

export function problem(status: number, code: string, detail: string) {
  return NextResponse.json(
    {
      type: `https://borrowflow.internal/errors/${code.toLowerCase().replace(/_/g, "-")}`,
      title: code, status, detail, code,
      requestId: `req-${Date.now()}`,
    },
    { status }
  );
}

export function toProblem(e: unknown) {
  const status = (e as { status?: number })?.status ?? 500;
  const message = e instanceof Error ? e.message : "Internal error";
  const code = status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : status === 409 ? "CONFLICT" : "INTERNAL_ERROR";
  return problem(status, code, message);
}

export async function authed(perm?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (perm) requirePerm(user, perm);
  return user;
}
