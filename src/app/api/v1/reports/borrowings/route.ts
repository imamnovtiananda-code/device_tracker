import { NextResponse } from "next/server";
import { authed, ok, toProblem } from "@/lib/api";
import { listBorrowings } from "@/lib/services";

export async function GET(req: Request) {
  try {
    const user = await authed("reports.read");
    const url = new URL(req.url);
    const rows = listBorrowings(user);
    if (url.searchParams.get("format") === "csv") {
      const header = "request_number,borrower,purpose,status,start_at,due_at\n";
      const body = rows.map((b) => [b.requestNumber, `"${b.borrowerName}"`, `"${b.purpose.replace(/"/g, '""')}"`, b.status, b.startAt, b.dueAt].join(",")).join("\n");
      return new NextResponse(header + body, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="borrowings.csv"' } });
    }
    return ok(rows);
  } catch (e) { return toProblem(e); }
}
