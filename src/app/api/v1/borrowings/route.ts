import { authed, ok, toProblem } from "@/lib/api";
import { createBorrowing, listBorrowings } from "@/lib/services";

export async function GET(req: Request) {
  try {
    const user = await authed();
    const url = new URL(req.url);
    return ok(listBorrowings(user, { status: url.searchParams.get("status") ?? undefined, mine: url.searchParams.get("mine") === "1" }));
  } catch (e) { return toProblem(e); }
}

export async function POST(req: Request) {
  try {
    const user = await authed("borrowings.create");
    const body = await req.json();
    const id = createBorrowing(user, body);
    return ok({ id }, 201);
  } catch (e) { return toProblem(e); }
}
