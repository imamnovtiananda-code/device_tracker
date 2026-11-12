import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { dashboardKpis, listBorrowings, listAssets } from "@/lib/services";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const kpi = dashboardKpis();
  const borrowings = listBorrowings(user);
  const overdue = borrowings.filter((b) => b.overdue);
  const { assets } = listAssets();
  const byStatus = new Map<string, number>();
  for (const a of assets) byStatus.set(a.status, (byStatus.get(a.status) ?? 0) + 1);
  const byCategory = new Map<string, number>();
  for (const a of assets) byCategory.set(a.categoryName, (byCategory.get(a.categoryName) ?? 0) + 1);
  return (
    <div>
      <h2>Laporan</h2>
      <p className="sub">Ringkasan utilisasi, keterlambatan, dan transaksi peminjaman. Export CSV tersedia lewat API <code>/api/v1/reports/borrowings?format=csv</code>.</p>
      <div className="grid">
        <div className="card kpi"><div className="label">Total peminjaman</div><div className="value">{kpi.totalBorrowings}</div></div>
        <div className="card kpi"><div className="label">Peminjaman aktif</div><div className="value">{kpi.activeBorrowings}</div></div>
        <div className="card kpi"><div className="label">Overdue</div><div className={`value ${kpi.overdue ? "bad" : ""}`}>{kpi.overdue}</div></div>
        <div className="card kpi"><div className="label">Utilisasi aset</div><div className="value">{kpi.utilization}%</div></div>
      </div>
      <div className="row">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Aset per status</h3>
          <ul>{[...byStatus.entries()].map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
          <h3>Aset per kategori</h3>
          <ul>{[...byCategory.entries()].map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Daftar overdue</h3>
          {overdue.length === 0 && <p>Tidak ada peminjaman terlambat.</p>}
          <ul>
            {overdue.map((b) => <li key={b.id}><Link href={`/borrowings/${b.id}`}>{b.requestNumber}</Link> — {b.borrowerName}, jatuh tempo {b.dueAt.slice(0, 10)}</li>)}
          </ul>
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Semua transaksi peminjaman</h3>
        <table className="table">
          <thead><tr><th>No.</th><th>Peminjam</th><th>Keperluan</th><th>Status</th><th>Jatuh Tempo</th></tr></thead>
          <tbody>
            {borrowings.map((b) => <tr key={b.id}><td>{b.requestNumber}</td><td>{b.borrowerName}</td><td>{b.purpose}</td><td><span className={`badge ${b.status}`}>{b.overdue ? "overdue" : b.status}</span></td><td>{b.dueAt.slice(0, 10)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
