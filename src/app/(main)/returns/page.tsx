import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listBorrowings } from "@/lib/services";

export default async function ReturnsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const rows = listBorrowings(user).filter((b) => ["borrowed", "partially_returned"].includes(b.status));
  return (
    <div>
      <h2>Pengembalian</h2>
      <p className="sub">Antrean pengembalian — barang yang sedang dipinjam. Inspeksi kondisi dilakukan di halaman detail peminjaman.</p>
      <table className="table">
        <thead><tr><th>No.</th><th>Peminjam</th><th>Keperluan</th><th>Jatuh Tempo</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td>{b.requestNumber}</td>
              <td>{b.borrowerName}</td>
              <td>{b.purpose}</td>
              <td>{b.dueAt.slice(0, 10)}</td>
              <td><span className={`badge ${b.status}`}>{b.overdue ? "overdue" : b.status}</span></td>
              <td><Link href={`/borrowings/${b.id}`}>Proses pengembalian</Link></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6}>Tidak ada peminjaman yang menunggu pengembalian.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
