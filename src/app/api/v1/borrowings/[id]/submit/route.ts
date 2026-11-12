import { authed, ok, toProblem } from "@/lib/api";
import { submitBorrowing } from "@/lib/services";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authed("borrowings.submit");
    const { id } = await params;
    submitBorrowing(user, id);
    return ok({ id, status: "pending_approval" });
  } catch (e) { return toProblem(e); }
}
