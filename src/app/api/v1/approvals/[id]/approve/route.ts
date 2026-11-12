import { authed, ok, toProblem } from "@/lib/api";
import { decideApproval } from "@/lib/services";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authed("approvals.approve");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    decideApproval(user, id, "approve", body.comments);
    return ok({ taskId: id, action: "approve" });
  } catch (e) { return toProblem(e); }
}
