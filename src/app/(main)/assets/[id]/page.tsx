import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { getAsset, listAssets } from "@/lib/services";
import { assetQrDataUrl } from "@/lib/qr";
import { updateAssetAction, archiveAssetAction } from "@/lib/actions";

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  const data = getAsset(id);
  if (!data) notFound();
  const { asset, history, category, location } = data;
  const qr = await assetQrDataUrl(asset.id, asset.assetCode);
  const { locations } = listAssets();
  const canEdit = can(user, "assets.update");
  return (
    <div>
      <Link href="/assets">← Kembali ke katalog</Link>
      <h2 style={{ marginTop: 12 }}>{asset.name}</h2>
      <p className="sub">{asset.assetCode} · {category?.name ?? "—"} · {asset.brand} {asset.model}</p>
      <div className="row">
        <div className="card">
          <p><b>Status:</b> <span className={`badge ${asset.status}`}>{asset.status}</span></p>
          <p><b>Kondisi:</b> {asset.condition}</p>
          <p><b>Tipe:</b> {asset.assetType}{asset.assetType === "quantity" ? ` — stok total ${asset.quantityTotal}` : ""}</p>
          <p><b>Serial:</b> {asset.serialNumber ?? "—"}</p>
          <p><b>Lokasi:</b> {location?.name ?? "—"}</p>
          <p><b>Deskripsi:</b> {asset.description ?? "—"}</p>
          {qr && (
            <div style={{ marginTop: 12 }}>
              <b>QR Code</b>
              <div><img src={qr} alt={`QR ${asset.assetCode}`} width={160} height={160} /></div>
              <span style={{ fontSize: 12, color: "#64748b" }}>Scan untuk membuka detail aset ini (hanya berisi URL internal).</span>
            </div>
          )}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Riwayat status</h3>
          <ul className="timeline">
            {history.map((h) => (
              <li key={h.id}>{h.status} · {h.createdAt.slice(0, 19).replace("T", " ")}{h.note ? ` — ${h.note}` : ""}</li>
            ))}
            {history.length === 0 && <li>Belum ada riwayat perubahan status.</li>}
          </ul>
        </div>
      </div>
      {canEdit && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Ubah aset</h3>
          <form action={updateAssetAction}>
            <input type="hidden" name="id" value={asset.id} />
            <div className="row">
              <div className="field"><label>Nama</label><input name="name" defaultValue={asset.name} /></div>
              <div className="field"><label>Status</label>
                <select name="status" defaultValue={asset.status}>
                  {["available", "reserved", "borrowed", "maintenance", "damaged", "lost", "retired"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field"><label>Kondisi</label>
                <select name="condition" defaultValue={asset.condition}>
                  {["good", "minor_damage", "major_damage", "missing_component", "lost"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field"><label>Lokasi</label>
                <select name="locationId" defaultValue={asset.locationId ?? ""}>
                  <option value="">—</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label>Deskripsi</label><textarea name="description" defaultValue={asset.description ?? ""} /></div>
            <button className="btn primary" type="submit">Simpan perubahan</button>
          </form>
          {can(user, "assets.archive") && (
            <form action={archiveAssetAction} style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={asset.id} />
              <button className="btn danger" type="submit">Arsipkan aset</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
