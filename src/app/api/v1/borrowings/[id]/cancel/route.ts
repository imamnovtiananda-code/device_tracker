import { authed, ok, toProblem } from "@/lib/api";
import { cancelBorrowing } from "@/lib/services";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authed();
    const { id } = await params;
    cancelBorrowing(user, id);
    return ok({ id, status: "cancelled" });
  } catch (e) { return toProblem(e); }
}
