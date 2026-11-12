import { NextResponse } from "next/server";
import { authed, ok, toProblem } from "@/lib/api";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { processDueReminders } from "@/lib/services";

export async function GET() {
  try {
    const user = await authed("reminders.manage");
    const db = getDb();
    return ok({
      rules: db.select().from(s.reminderRules).all(),
      instances: db.select().from(s.reminderInstances).all().slice(0, 200),
    });
  } catch (e) { return toProblem(e); }
}

// Manual trigger for the in-process reminder engine (MVP replacement for the BullMQ scheduler).
export async function POST() {
  try {
    await authed("reminders.manage");
    return ok(processDueReminders());
  } catch (e) { return toProblem(e); }
}
