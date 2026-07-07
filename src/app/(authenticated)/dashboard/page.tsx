import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const userCount = await prisma.user.count();

  return (
    <section className="stack">
      <div className="hero stack">
        <p className="eyebrow">Foundation ready</p>
        <h1>Dashboard shell</h1>
        <p className="muted">
          The authenticated workspace is online and Prisma is connected to the
          local SQLite database.
        </p>
      </div>
      <div className="placeholder-grid">
        <article className="placeholder stack">
          <h2>Database status</h2>
          <p className="muted">
            Fixed-user records available in the current environment: {userCount}
          </p>
        </article>
        <article className="placeholder stack">
          <h2>Next tasks</h2>
          <p className="muted">
            Domain CRUD, valuation logic, snapshots, and dashboard metrics land
            in the child tasks that follow this foundation.
          </p>
        </article>
      </div>
    </section>
  );
}
