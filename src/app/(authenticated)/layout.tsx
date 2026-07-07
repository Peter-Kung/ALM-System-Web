import { redirect } from "next/navigation";
import { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { getSessionFromCookies } from "@/lib/auth/session";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  return <AppShell username={session.username}>{children}</AppShell>;
}
