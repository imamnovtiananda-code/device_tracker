import { authed, ok, toProblem } from "@/lib/api";
import { getBorrowing } from "@/lib/services";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authed();
    const { id } = await params;
    const data = getBorrowing(id);
    if (!data) return toProblem(Object.assign(new Error("Peminjaman tidak ditemukan"), { status: 404 }));
    return ok(data);
  } catch (e) { return toProblem(e); }
}
