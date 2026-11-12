import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { getBorrowing } from "@/lib/services";
import { submitBorrowingAction, cancelBorrowingAction, checkoutAction, createReturnAction, requestExtensionAction } from "@/lib/actions";

export default async function BorrowingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  const data = getBorrowing(id);
  if (!data) notFound();
  const { borrowing: b, borrower, items, history, tasks, reminders, overdue } = data;
  const isOwner = b.borrowerId === user.id;
  const canCheckout = can(user, "borrowings.checkout") && ["approved", "ready_for_pickup"].includes(b.status);
  const canReturn = can(user, "returns.receive") && ["borrowed", "partially_returned"].includes(b.status);
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  return (
    <div>
      <Link href="/borrowings">← Kembali ke peminjaman</Link>
      <h2 style={{ marginTop: 12 }}>{b.requestNumber} <span className={`badge ${b.status}`}>{overdue ? "overdue" : b.status}</span></h2>
      <p className="sub">Peminjam: {borrower?.fullName} · Keperluan: {b.purpose}</p>
      <div className="row">
        <div className="card">
          <p><b>Mulai:</b> {b.startAt.slice(0, 10)} · <b>Jatuh tempo:</b> {b.dueAt.slice(0, 10)}</p>
          <p><b>Diajukan:</b> {b.submittedAt ? b.submittedAt.slice(0, 10) : "— (masih draft)"}</p>
          <h3>Item</h3>
          <table className="table">
            <thead><tr><th>Aset</th><th>Jumlah</th><th>Dikembalikan</th><th>Kondisi keluar</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.asset?.name} ({i.asset?.assetCode})</td>
                  <td>{i.quantity}</td>
                  <td>{i.returnedQuantity}</td>
                  <td>{i.conditionOut ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Approval</h3>
          {pendingTasks.length === 0 && tasks.length === 0 && <p>Belum ada approval (masih draft).</p>}
          {tasks.map((t) => <p key={t.id}>Tugas {t.status} — ditugaskan ke {t.assignedTo}{t.comments ? ` · “${t.comments}”` : ""}</p>)}
          <h3>Reminder terjadwal</h3>
          <ul>
            {reminders.map((r) => <li key={r.id}>{r.scheduledAt.slice(0, 16).replace("T", " ")} — {r.status}</li>)}
            {reminders.length === 0 && <li>Belum ada reminder (dibuat saat checkout).</li>}
          </ul>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Timeline</h3>
          <ul className="timeline">
            {history.map((h) => <li key={h.id}>{h.status} · {h.createdAt.slice(0, 19).replace("T", " ")}{h.note ? ` — ${h.note}` : ""}</li>)}
          </ul>
          <h3>Aksi</h3>
          {b.status === "draft" && isOwner && (
            <form action={submitBorrowingAction} style={{ marginBottom: 8 }}>
              <input type="hidden" name="id" value={b.id} />
              <button className="btn primary" type="submit">Submit untuk approval</button>
            </form>
          )}
          {["draft", "pending_approval"].includes(b.status) && isOwner && (
            <form action={cancelBorrowingAction} style={{ marginBottom: 8 }}>
              <input type="hidden" name="id" value={b.id} />
              <button className="btn danger" type="submit">Batalkan pengajuan</button>
            </form>
          )}
          {canCheckout && (
            <form action={checkoutAction} style={{ marginBottom: 8 }}>
              <input type="hidden" name="id" value={b.id} />
              <button className="btn primary" type="submit">Checkout / Serah terima</button>
            </form>
          )}
          {!canCheckout && ["approved", "ready_for_pickup"].includes(b.status) && (
            <p className="notice">Menunggu checkout oleh Asset Officer / Asset Manager.</p>
          )}
        </div>
      </div>

      {canReturn && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Pengembalian &amp; Inspeksi</h3>
          <form action={createReturnAction}>
            <input type="hidden" name="borrowingId" value={b.id} />
            <table className="table">
              <thead><tr><th>Aset</th><th>Sisa</th><th>Jumlah kembali</th><th>Kondisi masuk</th></tr></thead>
              <tbody>
                {items.filter((i) => i.quantity - i.returnedQuantity > 0).map((i) => (
                  <tr key={i.id}>
                    <td>{i.asset?.name}</td>
                    <td>{i.quantity - i.returnedQuantity}</td>
                    <td>
                      <input type="hidden" name="borrowingItemId" value={i.id} />
                      <input type="number" name="quantity" min={0} max={i.quantity - i.returnedQuantity} defaultValue={i.quantity - i.returnedQuantity} style={{ width: 80 }} />
                    </td>
                    <td>
                      <select name="conditionIn">
                        <option value="good">Good</option>
                        <option value="minor_damage">Minor damage</option>
                        <option value="major_damage">Major damage</option>
                        <option value="missing_component">Missing component</option>
                        <option value="lost">Lost</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn primary" type="submit" style={{ marginTop: 10 }}>Catat pengembalian</button>
          </form>
        </div>
      )}

      {isOwner && ["borrowed", "partially_returned"].includes(b.status) && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Perpanjangan (Extension)</h3>
          <p className="sub">Perpanjangan butuh approval dan dicek konflik ketersediaan.</p>
          <form action={requestExtensionAction}>
            <input type="hidden" name="borrowingId" value={b.id} />
            <div className="row">
              <div className="field"><label>Tanggal kembali baru</label><input type="date" name="newDueAt" required /></div>
              <div className="field"><label>Alasan</label><input name="reason" required placeholder="Contoh: Proyek diperpanjang" /></div>
            </div>
            <button className="btn" type="submit">Ajukan perpanjangan</button>
          </form>
        </div>
      )}
    </div>
  );
}
