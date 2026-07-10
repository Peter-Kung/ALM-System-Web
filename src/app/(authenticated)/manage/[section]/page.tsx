import { notFound } from "next/navigation";
import React from "react";

import { ManagementSection } from "@/components/management-section";
import { managementSections } from "@/lib/navigation";

export default async function ManagementSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  if (!managementSections.has(section)) {
    notFound();
  }

  return <ManagementSection section={section} />;
}
