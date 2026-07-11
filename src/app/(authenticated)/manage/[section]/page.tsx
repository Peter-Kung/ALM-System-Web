import { notFound } from "next/navigation";
import React from "react";

import { canCurrentUserAccessManagementSection } from "@/app/(authenticated)/manage/[section]/access";
import { ManagementSection } from "@/components/management-section";

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
