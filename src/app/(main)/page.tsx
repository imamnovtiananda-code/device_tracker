import { cookies } from "next/headers";
import Link from "next/link";
import { getCurrentUser, can } from "@/lib/auth";
import { detectLocale, getDict } from "@/lib/i18n";
import { dashboardKpis, listBorrowings, ensureSeed } from "@/lib/services";

export default async function DashboardPage() {
  ensureSeed();
  const user = await getCurrentUser();
  if (!user) return null;
  const jar = await cookies();
  const t = getDict(detectLocale(jar.get("dt_locale")?.value));
  const kpi = dashboardKpis();
  const borrowings = listBorrowings(user).slice(0, 8);
  const overdue = listBorrowings(user).filter((b) => b.overdue);
  const cards = [
    { label: t.totalAssets, value: kpi.totalAssets, cls: "" },
    { label: t.available, value: kpi.available, cls: "" },
    { label: t.borrowed, value: kpi.borrowed, cls: "" },
    { label: t.pendingApproval, value: kpi.pendingApprovals, cls: kpi.pendingApprovals ? "warn" : "" },
    { label: t.dueToday, value: kpi.dueToday, cls: kpi.dueToday ? "warn" : "" },
    { label: t.overdue, value: kpi.overdue, cls: kpi.overdue ? "bad" : "" },
    { label: "Utilisasi aset", value: `${kpi.utilization}%`, cls: "" },
    { label: "Peminjaman aktif", value: kpi.activeBorrowings, cls: "" },
  ];
  return (
    <div>
      <div className="topbar">
        <div>
          <h2>{t.dashboard}</h2>
          <p className="sub">Selamat datang, {user.fullName} — ringkasan operasional peminjaman aset.</p>
        </div>
        {can(user, "borrowings.create") && <Link className="btn primary" href="/borrowings/new">+ {t.newBorrowing}</Link>}
      </div>
      <div className="grid">
        {cards.map((c) => (
          <div key={c.label} className="card kpi">
            <div className="label">{c.label}</div>
            <div className={`value ${c.cls}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {overdue.length > 0 && (
        <div className="alert">
          <b>Eskalasi overdue:</b> {overdue.length} peminjaman terlambat —{" "}
          {overdue.map((b) => `${b.requestNumber} (${b.borrowerName}, jatuh tempo ${b.dueAt.slice(0, 10)})`).join("; ")}.
          Asset Manager sudah menerima notifikasi eskalasi.
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Peminjaman terbaru</h3>
        <table className="table">
          <thead><tr><th>No.</th><th>{t.borrower}</th><th>{t.purpose}</th><th>{t.status}</th><th>{t.dueDate}</th><th></th></tr></thead>
          <tbody>
            {borrowings.map((b) => (
              <tr key={b.id}>
                <td>{b.requestNumber}</td>
                <td>{b.borrowerName}</td>
                <td>{b.purpose}</td>
                <td><span className={`badge ${b.status}`}>{b.overdue ? "overdue" : b.status}</span></td>
                <td>{b.dueAt.slice(0, 10)}</td>
                <td><Link href={`/borrowings/${b.id}`}>Detail</Link></td>
              </tr>
            ))}
            {borrowings.length === 0 && <tr><td colSpan={6}>Belum ada peminjaman.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="sub">MVP lokal: auth demo, database SQLite lokal, reminder in-process. Lihat README untuk keterbatasan vs PRD enterprise.</p>
    </div>
  );
}
