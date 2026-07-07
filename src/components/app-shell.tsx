import Link from "next/link";
import { ReactNode } from "react";

import { appSections } from "@/lib/navigation";

type AppShellProps = {
  children: ReactNode;
  username: string;
};

export function AppShell({ children, username }: AppShellProps) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <p className="eyebrow">Private finance workspace</p>
          <h1>ALM System</h1>
          <p className="muted">Signed in as {username}</p>
        </div>
        <nav className="stack">
          {appSections.map((section) => (
            <Link key={section.href} href={section.href} className="nav-link">
              {section.label}
            </Link>
          ))}
        </nav>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="ghost-button">
            Sign out
          </button>
        </form>
      </aside>
      <main className="main-panel">{children}</main>
    </div>
  );
}
