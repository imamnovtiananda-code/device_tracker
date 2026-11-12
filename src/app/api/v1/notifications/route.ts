import { authed, ok, toProblem } from "@/lib/api";
import { listNotifications } from "@/lib/services";

export async function GET() {
  try {
    const user = await authed();
    return ok(listNotifications(user));
  } catch (e) { return toProblem(e); }
}
