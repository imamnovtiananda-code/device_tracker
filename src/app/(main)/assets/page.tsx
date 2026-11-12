import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUser, can } from "@/lib/auth";
import { detectLocale, getDict } from "@/lib/i18n";
import { listAssets } from "@/lib/services";

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; categoryId?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  const jar = await cookies();
  const t = getDict(detectLocale(jar.get("dt_locale")?.value));
  const { assets, categories } = listAssets({ q: sp.q, status: sp.status, categoryId: sp.categoryId });
  return (
    <div>
      <div className="topbar">
        <div><h2>{t.catalog}</h2><p className="sub">{assets.length} aset · ketersediaan dihitung server-side, double booking dicegah.</p></div>
        {can(user, "assets.create") && <Link className="btn primary" href="/assets/new">+ {t.newAsset}</Link>}
      </div>
      <form method="get" className="card" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <input name="q" placeholder={t.search} defaultValue={sp.q ?? ""} style={{ flex: 1 }} />
        <select name="status" defaultValue={sp.status ?? ""} style={{ width: 180 }}>
          <option value="">Semua status</option>
          {["available", "reserved", "borrowed", "maintenance", "damaged", "lost", "retired"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select name="categoryId" defaultValue={sp.categoryId ?? ""} style={{ width: 180 }}>
          <option value="">Semua kategori</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn primary" type="submit">Filter</button>
      </form>
      <table className="table">
        <thead><tr><th>Kode</th><th>Nama</th><th>{t.category}</th><th>Tipe</th><th>{t.status}</th><th>Kondisi</th><th>{t.location}</th><th></th></tr></thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.id}>
              <td>{a.assetCode}</td>
              <td>{a.name}{a.serialNumber ? <><br /><span style={{ color: "#64748b", fontSize: 12 }}>{a.serialNumber}</span></> : ""}</td>
              <td>{a.categoryName}</td>
              <td>{a.assetType}{a.assetType === "quantity" ? ` (${a.quantityTotal})` : ""}</td>
              <td><span className={`badge ${a.status}`}>{a.status}</span></td>
              <td>{a.condition}</td>
              <td>{a.locationName}</td>
              <td><Link href={`/assets/${a.id}`}>Detail</Link></td>
            </tr>
          ))}
          {assets.length === 0 && <tr><td colSpan={8}>Tidak ada aset yang cocok.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
