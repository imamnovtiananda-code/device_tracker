# Device Tracker (BorrowFlow) — MVP Lokal

Aplikasi internal peminjaman aset perusahaan, dibangun dari PRD
`BorrowFlow_Enterprise_PRD_Technical_Blueprint.md` v1.0 — **versi MVP lokal**,
bukan full enterprise stack.

Fitur: dashboard KPI, master aset + QR, katalog & ketersediaan
(serialized & quantity-based, cegah double booking), peminjaman
(draft → approval → checkout → return → closed), approval berjenjang
(blokir self-approval, alasan tolak wajib), checkout & return
(partial/full + inspeksi kondisi), perpanjangan dengan approval,
reminder H-3 / H-1 / H / H+1 + notifikasi in-app + eskalasi overdue,
laporan & audit log, RBAC, i18n id-ID/en-US, PWA minimal.

## Cara menjalankan di VS Code (lokal)

Persyaratan: Node.js 20+ dan npm (tidak butuh Docker, PostgreSQL, atau Redis).

```bash
git clone <repo-kamu>
cd device-tracker
npm install
npm run dev
```

Buka http://localhost:3000 — database SQLite dibuat otomatis di
`data/borrowflow.db` beserta seed data saat pertama kali dibuka
(atau jalankan `npm run seed`).

Build produksi:

```bash
npm run build
npm start
```

## Akun demo (login demo — pilih pengguna, tanpa password)

| Pengguna | Role | Email |
|---|---|---|
| Andi Admin | Admin | admin@borrowflow.local |
| Maya Manager | Asset Manager | manager@borrowflow.local |
| Oki Officer | Asset Officer | officer@borrowflow.local |
| Rani Approver | Department Manager / Approver | approver@borrowflow.local |
| Budi Karyawan | Employee | budi@borrowflow.local |
| Sari Karyawan | Employee | sari@borrowflow.local |

Alur demo end-to-end:
1. Masuk sebagai **Budi Karyawan** → buat pengajuan peminjaman (laptop/proyektor) → Submit.
2. Masuk sebagai **Rani Approver** → Approval Inbox → Setujui.
3. Masuk sebagai **Oki Officer** → buka peminjaman → Checkout.
4. Masuk sebagai **Oki Officer** lagi → proses pengembalian + inspeksi kondisi.
5. Lihat Dashboard / Laporan / Audit Log sebagai **Maya Manager** atau **Andi Admin**.

## API

Base: `/api/v1` — lihat PRD §12. Contoh: `GET /api/v1/assets`,
`GET /api/v1/borrowings`, `POST /api/v1/borrowings/:id/submit`,
`GET /api/v1/approvals/inbox`, `POST /api/v1/returns`,
`GET /api/v1/reports/dashboard`, `GET /api/v1/audit-logs`.
Semua endpoint memeriksa session + permission di server dan
mengembalikan Problem Details (RFC 9457) saat error.

## Keterbatasan MVP vs PRD full

- **Auth:** login demo pilih user (tanpa password), bukan OIDC/Keycloak + MFA.
- **Database:** SQLite file lokal (Drizzle), bukan PostgreSQL.
- **Queue:** reminder in-process (diproses saat halaman dimuat +
  `POST /api/v1/reminders`), bukan Redis/BullMQ.
- **Storage:** tanpa MinIO/S3; lampiran file belum diimplementasikan.
- **Notifikasi:** in-app saja; email / web push / WhatsApp belum ada.
- **Lainnya:** tanpa Keycloak, tanpa Docker Compose, tanpa
  maintenance & incident module, tanpa import CSV massal,
  tanpa scan QR via kamera (QR hanya ditampilkan per aset).
- Struktur folder, penamaan tabel, status lifecycle, dan kontrak API
  mengikuti PRD supaya bisa di-upgrade ke stack enterprise.

---

# Device Tracker (BorrowFlow) — Local MVP (English summary)

Internal company asset-borrowing app built from the BorrowFlow PRD v1.0
— **local MVP**, not the full enterprise stack.

Run locally: `npm install && npm run dev`, then open
http://localhost:3000. Demo login: pick a user above (no password).
SQLite database is created automatically at `data/borrowflow.db` with
seed data. See the Indonesian section above for the demo flow and the
MVP limitations vs the full PRD (demo auth instead of OIDC/Keycloak,
SQLite instead of PostgreSQL, in-process reminders instead of
Redis/BullMQ, in-app notifications only, no MinIO, no Docker).
