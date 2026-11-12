import { listUsers, ensureSeed } from "@/lib/services";
import { loginAction } from "@/lib/actions";
import { ROLE_LABEL } from "@/lib/auth";

export default async function LoginPage() {
  ensureSeed();
  const users = listUsers();
  return (
    <div className="login-wrap">
      <div className="card">
        <h2 style={{ marginBottom: 4 }}>Device Tracker</h2>
        <p className="sub">BorrowFlow MVP — peminjaman aset perusahaan.</p>
        <p className="notice">Login demo — pilih pengguna, tanpa password. Jangan dipakai untuk produksi (PRD memakai OIDC/Keycloak).</p>
        {users.map((u) => (
          <form key={u.id} action={loginAction}>
            <input type="hidden" name="userId" value={u.id} />
            <button className="user-pick" type="submit">
              <b>{u.fullName}</b>
              <span>{ROLE_LABEL[u.role] ?? u.role} · {u.email} · {u.employeeNo}</span>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
