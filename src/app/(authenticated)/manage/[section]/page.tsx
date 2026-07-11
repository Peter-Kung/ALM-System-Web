import { notFound } from "next/navigation";
import React from "react";

import { ManagementSection } from "@/components/management-section";
import { getSessionFromCookies } from "@/lib/auth/session";
import { canAccessManagementSection } from "@/lib/navigation";
import { validateSessionPayload } from "@/modules/auth";
import { createAuthRepository } from "@/modules/auth/repository";

export default async function ManagementSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  if (!(await canCurrentUserAccessManagementSection(section))) {
    notFound();
  }

  return <ManagementSection section={section} />;
}

export async function canCurrentUserAccessManagementSection(section: string) {
  if (section !== "users") {
    return canAccessManagementSection(section, "USER");
  }

  const session = await getSessionFromCookies();
  if (!session) {
    return false;
  }

  const validSession = await validateSessionPayload(session, createAuthRepository());
  return validSession ? canAccessManagementSection(section, validSession.role) : false;
}
