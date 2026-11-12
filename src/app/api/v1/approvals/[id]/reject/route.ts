import { authed, ok, toProblem } from "@/lib/api";
import { decideApproval } from "@/lib/services";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authed("approvals.reject");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    decideApproval(user, id, "reject", body.comments);
    return ok({ taskId: id, action: "reject" });
  } catch (e) { return toProblem(e); }
}
