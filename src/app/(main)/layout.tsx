import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, ROLE_LABEL } from "@/lib/auth";
import { detectLocale, getDict } from "@/lib/i18n";
import { ensureSeed, processDueReminders, unreadCount } from "@/lib/services";
import { logoutAction, setLocaleAction } from "@/lib/actions";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  ensureSeed();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Reminder engine (MVP, in-process): process due reminders on each
  // authenticated page load — PRD §5.10 without BullMQ.
  try { processDueReminders(); } catch { /* never block the page on reminders */ }
  const jar = await cookies();
  const locale = detectLocale(jar.get("dt_locale")?.value);
  const t = getDict(locale);
  const unread = unreadCount(user);
  const nav: { href: string; label: string }[] = [
    { href: "/", label: t.dashboard },
    { href: "/assets", label: t.catalog },
    { href: "/borrowings", label: t.borrowings },
    { href: "/borrowings/new", label: t.newBorrowing },
    { href: "/approvals", label: t.approvals },
    { href: "/returns", label: t.returns },
    { href: "/notifications", label: `${t.notifications}${unread ? ` (${unread})` : ""}` },
    { href: "/reports", label: t.reports },
    { href: "/audit", label: t.audit },
  ];
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>{t.appName}</h1>
        <div className="tag">{t.tagline} · BorrowFlow MVP</div>
        {nav.map((n) => (
          <Link key={n.href} href={n.href}>{n.label}</Link>
        ))}
        <div className="spacer" />
        <form action={setLocaleAction}>
          <input type="hidden" name="locale" value={locale === "id-ID" ? "en-US" : "id-ID"} />
          <button className="btn" type="submit" style={{ width: "100%" }}>
            {locale === "id-ID" ? "English" : "Bahasa Indonesia"}
          </button>
        </form>
        <div className="who">{user.fullName}<br />{ROLE_LABEL[user.role] ?? user.role} · {user.email}</div>
        <form action={logoutAction}>
          <button className="btn" type="submit" style={{ width: "100%" }}>{t.logout}</button>
        </form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
