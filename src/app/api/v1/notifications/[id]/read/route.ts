import { authed, ok, toProblem } from "@/lib/api";
import { markNotificationRead } from "@/lib/services";

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authed();
    const { id } = await params;
    markNotificationRead(user, id);
    return ok({ id, read: true });
  } catch (e) { return toProblem(e); }
}
