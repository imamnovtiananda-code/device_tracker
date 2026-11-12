import { authed, ok, toProblem } from "@/lib/api";
import { dashboardKpis } from "@/lib/services";

export async function GET() {
  try {
    await authed("reports.read");
    return ok(dashboardKpis());
  } catch (e) { return toProblem(e); }
}
