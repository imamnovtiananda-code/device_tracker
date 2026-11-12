import Link from "next/link";
import { getCurrentUser, can } from "@/lib/auth";
import { listBorrowings } from "@/lib/services";

export default async function BorrowingsPage({ searchParams }: { searchParams: Promise<{ status?: string; mine?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  const rows = listBorrowings(user, { status: sp.status, mine: sp.mine === "1" });
  return (
    <div>
      <div className="topbar">
        <div><h2>Peminjaman</h2><p className="sub">{rows.length} peminjaman · lifecycle: draft → submitted → pending_approval → approved → ready_for_pickup → borrowed → returned → closed.</p></div>
        {can(user, "borrowings.create") && <Link className="btn primary" href="/borrowings/new">+ Pengajuan Baru</Link>}
      </div>
      <form method="get" className="card" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <select name="status" defaultValue={sp.status ?? ""} style={{ width: 220 }}>
          <option value="">Semua status</option>
          {["draft", "submitted", "pending_approval", "approved", "ready_for_pickup", "borrowed", "partially_returned", "returned", "closed", "rejected", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          <input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === "1"} /> Hanya milik saya
        </label>
        <button className="btn" type="submit">Filter</button>
      </form>
      <table className="table">
        <thead><tr><th>No.</th><th>Peminjam</th><th>Keperluan</th><th>Mulai</th><th>Jatuh Tempo</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td>{b.requestNumber}</td>
              <td>{b.borrowerName}</td>
              <td>{b.purpose}</td>
              <td>{b.startAt.slice(0, 10)}</td>
              <td>{b.dueAt.slice(0, 10)}</td>
              <td><span className={`badge ${b.status}`}>{b.overdue ? "overdue" : b.status}</span></td>
              <td><Link href={`/borrowings/${b.id}`}>Detail</Link></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7}>Belum ada peminjaman.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
