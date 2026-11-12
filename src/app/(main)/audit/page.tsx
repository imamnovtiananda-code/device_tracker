import { getCurrentUser, requirePerm } from "@/lib/auth";
import { listAudit } from "@/lib/services";

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  let rows: ReturnType<typeof listAudit> = [];
  let forbidden = false;
  try {
    requirePerm(user, "audit.read");
    rows = listAudit();
  } catch {
    forbidden = true;
  }
  if (forbidden) {
    return <div><h2>Audit Log</h2><div className="alert">Anda tidak memiliki permission audit.read.</div></div>;
  }
  return (
    <div>
      <h2>Audit Log</h2>
      <p className="sub">Append-only: semua mutasi kritis (aset, peminjaman, approval, checkout, return, extension) tercatat dengan actor dan waktu.</p>
      <table className="table">
        <thead><tr><th>Waktu</th><th>Actor</th><th>Aksi</th><th>Entitas</th><th>ID</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.createdAt.slice(0, 19).replace("T", " ")}</td>
              <td>{r.actorName}</td>
              <td>{r.action}</td>
              <td>{r.entityType}</td>
              <td style={{ fontSize: 12 }}>{r.entityId}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5}>Belum ada audit log.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
