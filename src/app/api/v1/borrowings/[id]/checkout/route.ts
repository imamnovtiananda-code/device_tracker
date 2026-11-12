import { authed, ok, toProblem } from "@/lib/api";
import { checkoutBorrowing } from "@/lib/services";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authed("borrowings.checkout");
    const { id } = await params;
    checkoutBorrowing(user, id);
    return ok({ id, status: "borrowed" });
  } catch (e) { return toProblem(e); }
}
