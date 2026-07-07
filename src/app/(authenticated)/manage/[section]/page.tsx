import { notFound } from "next/navigation";

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

  return (
    <section className="stack">
      <div className="hero stack">
        <p className="eyebrow">Module scaffold</p>
        <h1>{section[0].toUpperCase() + section.slice(1)}</h1>
        <p className="muted">
          This protected page is reserved for the {section} domain workflow.
        </p>
      </div>
    </section>
  );
}
