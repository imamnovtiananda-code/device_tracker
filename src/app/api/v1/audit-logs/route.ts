import { authed, ok, toProblem } from "@/lib/api";
import { listAudit } from "@/lib/services";

export async function GET() {
  try {
    await authed("audit.read");
    return ok(listAudit());
  } catch (e) { return toProblem(e); }
}
