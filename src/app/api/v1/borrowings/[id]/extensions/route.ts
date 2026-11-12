import { authed, ok, toProblem } from "@/lib/api";
import { requestExtension } from "@/lib/services";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authed("borrowings.extend");
    const { id } = await params;
    const body = await req.json();
    const instanceId = requestExtension(user, id, body.newDueAt, body.reason ?? "");
    return ok({ id, approvalInstanceId: instanceId }, 201);
  } catch (e) { return toProblem(e); }
}
