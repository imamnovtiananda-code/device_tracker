import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { listAssets } from "@/lib/services";
import { createAssetAction } from "@/lib/actions";

export default async function NewAssetPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "assets.create")) redirect("/assets");
  const { categories, locations } = listAssets();
  return (
    <div>
      <Link href="/assets">← Kembali ke katalog</Link>
      <h2 style={{ marginTop: 12 }}>Aset Baru</h2>
      <p className="sub">Kode aset harus unik dalam organisasi (PRD §5.3).</p>
      <div className="card">
        <form action={createAssetAction}>
          <div className="row">
            <div className="field"><label>Kode aset *</label><input name="assetCode" required placeholder="AST-LTP-004" /></div>
            <div className="field"><label>Nama *</label><input name="name" required placeholder="Laptop Dell XPS 13" /></div>
            <div className="field"><label>Kategori</label>
              <select name="categoryId"><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <div className="field"><label>Tipe</label>
              <select name="assetType"><option value="serialized">Serialized (unit)</option><option value="quantity">Quantity-based (stok)</option></select>
            </div>
            <div className="field"><label>Serial number</label><input name="serialNumber" /></div>
            <div className="field"><label>Jumlah total (untuk quantity-based)</label><input name="quantityTotal" type="number" min={1} defaultValue={1} /></div>
            <div className="field"><label>Brand</label><input name="brand" /></div>
            <div className="field"><label>Model</label><input name="model" /></div>
            <div className="field"><label>Lokasi</label>
              <select name="locationId"><option value="">—</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
            </div>
          </div>
          <div className="field"><label>Deskripsi</label><textarea name="description" /></div>
          <button className="btn primary" type="submit">Simpan aset</button>
        </form>
      </div>
    </div>
  );
}
