"use client";

import dynamic from "next/dynamic";

const OperationsDashboard = dynamic(
  () =>
    import("./OperationsDashboard").then(
      (module) => module.OperationsDashboard,
    ),
  {
    ssr: false,
    loading: () => (
      <main className="main">
        <section className="panel section-card">
          <p>Cargando workspace local...</p>
        </section>
      </main>
    ),
  },
);

export function OperationsDashboardLoader() {
  return <OperationsDashboard />;
}
