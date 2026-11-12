import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { listAssets } from "@/lib/services";
import { createBorrowingAction } from "@/lib/actions";

export default async function NewBorrowingPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "borrowings.create")) redirect("/borrowings");
  const { assets } = listAssets();
  const available = assets.filter((a) => a.status === "available" && !a.archivedAt);
  const today = new Date();
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  const due = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
  return (
    <div>
      <Link href="/borrowings">← Kembali</Link>
      <h2 style={{ marginTop: 12 }}>Pengajuan Peminjaman Baru</h2>
      <p className="sub">Pilih aset yang tersedia. Ketersediaan divalidasi ulang di server saat submit &amp; checkout — double booking dicegah.</p>
      <div className="card">
        <form action={createBorrowingAction}>
          <div className="field"><label>Keperluan *</label><input name="purpose" required placeholder="Contoh: Presentasi ke klien" /></div>
          <div className="row">
            <div className="field"><label>Tanggal mulai *</label><input name="startAt" type="date" required defaultValue={isoDate(today)} /></div>
            <div className="field"><label>Tanggal kembali *</label><input name="dueAt" type="date" required defaultValue={isoDate(due)} /></div>
          </div>
          <div className="field">
            <label>Pilih aset * (centang yang dipinjam)</label>
            <table className="table">
              <thead><tr><th></th><th>Kode</th><th>Nama</th><th>Tipe</th><th>Jumlah</th></tr></thead>
              <tbody>
                {available.map((a) => (
                  <tr key={a.id}>
                    <td><input type="checkbox" name="assetIds" value={a.id} /></td>
                    <td>{a.assetCode}</td>
                    <td>{a.name}</td>
                    <td>{a.assetType}{a.assetType === "quantity" ? ` (stok ${a.quantityTotal})` : ""}</td>
                    <td><input type="number" name="quantities" min={1} max={a.assetType === "quantity" ? a.quantityTotal : 1} defaultValue={1} style={{ width: 80 }} /></td>
                  </tr>
                ))}
                {available.length === 0 && <tr><td colSpan={5}>Tidak ada aset tersedia saat ini.</td></tr>}
              </tbody>
            </table>
            <span style={{ fontSize: 12, color: "#64748b" }}>Jumlah berlaku untuk aset quantity-based; untuk serialized selalu 1.</span>
          </div>
          <button className="btn primary" type="submit">Buat draft peminjaman</button>
        </form>
      </div>
    </div>
  );
}
