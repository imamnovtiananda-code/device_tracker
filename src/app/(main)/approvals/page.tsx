import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { approvalInbox } from "@/lib/services";
import { decideApprovalAction } from "@/lib/actions";

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const inbox = approvalInbox(user);
  const pending = inbox.filter((t) => t.status === "pending");
  const done = inbox.filter((t) => t.status !== "pending");
  return (
    <div>
      <h2>Approval Inbox</h2>
      <p className="sub">{pending.length} tugas menunggu keputusan Anda. Penolakan wajib disertai alasan. Self-approval diblokir.</p>
      {pending.length === 0 && <div className="card">Tidak ada tugas approval yang menunggu.</div>}
      {pending.map((t) => (
        <div key={t.id} className="card" style={{ marginBottom: 12 }}>
          <b>{t.requestNumber}</b> · {t.borrowerName} · {t.purpose}
          {t.extension && <div style={{ fontSize: 14, marginTop: 4 }}>Perpanjangan: {t.extension.oldDueAt?.slice(0, 10)} → {t.extension.newDueAt?.slice(0, 10)} · Alasan: {t.extension.reason}</div>}
          <form action={decideApprovalAction} style={{ marginTop: 10 }}>
            <input type="hidden" name="taskId" value={t.id} />
            <div className="field"><label>Komentar / alasan (wajib jika menolak)</label><input name="comments" placeholder="Contoh: Disetujui untuk kegiatan resmi" /></div>
            <button className="btn primary" type="submit" name="action" value="approve">Setujui</button>
            <button className="btn danger" type="submit" name="action" value="reject">Tolak</button>
            <Link className="btn" href={t.instance.entityType === "borrowing" ? `/borrowings/${t.instance.entityId}` : "#"} style={{ marginLeft: 8 }}>Lihat detail</Link>
          </form>
        </div>
      ))}
      {done.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Riwayat keputusan</h3>
          <table className="table">
            <thead><tr><th>No.</th><th>Status</th><th>Komentar</th></tr></thead>
            <tbody>
              {done.map((t) => <tr key={t.id}><td>{t.requestNumber}</td><td><span className={`badge ${t.status}`}>{t.status}</span></td><td>{t.comments ?? "—"}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
