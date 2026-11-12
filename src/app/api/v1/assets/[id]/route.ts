import { authed, ok, toProblem } from "@/lib/api";
import { archiveAsset, getAsset, updateAsset } from "@/lib/services";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authed("assets.read");
    const { id } = await params;
    const data = getAsset(id);
    if (!data) return toProblem(Object.assign(new Error("Asset tidak ditemukan"), { status: 404 }));
    return ok(data);
  } catch (e) { return toProblem(e); }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authed("assets.update");
    const { id } = await params;
    const body = await req.json();
    updateAsset(user, id, body);
    return ok({ id });
  } catch (e) { return toProblem(e); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authed("assets.archive");
    const { id } = await params;
    archiveAsset(user, id);
    return ok({ id, archived: true });
  } catch (e) { return toProblem(e); }
}
