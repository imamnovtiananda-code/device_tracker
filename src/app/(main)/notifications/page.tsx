import { getCurrentUser } from "@/lib/auth";
import { listNotifications, processDueReminders } from "@/lib/services";
import { markReadAction } from "@/lib/actions";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  processDueReminders();
  const items = listNotifications(user);
  return (
    <div>
      <h2>Notifikasi</h2>
      <p className="sub">Notifikasi in-app: reminder H-3 / H-1 / H / H+1, approval, checkout, dan eskalasi overdue.</p>
      {items.length === 0 && <div className="card">Belum ada notifikasi.</div>}
      {items.map((n) => (
        <div key={n.id} className="card" style={{ marginBottom: 10, opacity: n.readAt ? 0.65 : 1 }}>
          <b>{n.title}</b> <span style={{ color: "#64748b", fontSize: 12 }}>{n.createdAt.slice(0, 19).replace("T", " ")}</span>
          <p style={{ margin: "6px 0" }}>{n.body}</p>
          {!n.readAt && (
            <form action={markReadAction}>
              <input type="hidden" name="id" value={n.id} />
              <button className="btn" type="submit">Tandai dibaca</button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
