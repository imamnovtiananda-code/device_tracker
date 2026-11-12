import { authed, ok, toProblem } from "@/lib/api";
import { approvalInbox } from "@/lib/services";

export async function GET() {
  try {
    const user = await authed("approvals.read_inbox");
    return ok(approvalInbox(user));
  } catch (e) { return toProblem(e); }
}
