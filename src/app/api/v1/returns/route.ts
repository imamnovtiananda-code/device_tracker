import { authed, ok, toProblem } from "@/lib/api";
import { createReturn, listBorrowings } from "@/lib/services";

export async function GET() {
  try {
    const user = await authed("returns.receive");
    return ok(listBorrowings(user).filter((b) => ["borrowed", "partially_returned"].includes(b.status)));
  } catch (e) { return toProblem(e); }
}

export async function POST(req: Request) {
  try {
    const user = await authed("returns.receive");
    const body = await req.json();
    const id = createReturn(user, body.borrowingId, body.items);
    return ok({ id }, 201);
  } catch (e) { return toProblem(e); }
}
