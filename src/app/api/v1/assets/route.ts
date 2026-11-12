import { authed, ok, toProblem } from "@/lib/api";
import { createAsset, listAssets } from "@/lib/services";

export async function GET(req: Request) {
  try {
    const user = await authed("assets.read");
    const url = new URL(req.url);
    return ok(listAssets({ q: url.searchParams.get("q") ?? undefined, status: url.searchParams.get("status") ?? undefined, categoryId: url.searchParams.get("categoryId") ?? undefined }));
  } catch (e) { return toProblem(e); }
}

export async function POST(req: Request) {
  try {
    const user = await authed("assets.create");
    const body = await req.json();
    const id = createAsset(user, body);
    return ok({ id }, 201);
  } catch (e) { return toProblem(e); }
}
