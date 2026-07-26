import { redirect } from "next/navigation";
import { PersistentDashboard } from "@/components/PersistentDashboard";
import {
  getAuthenticatedUser,
  getOperationsSnapshot,
} from "@/infrastructure/supabase/operations-repository";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export default async function Home() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="setup-page">
        <section className="setup-card">
          <span className="brand-mark">M</span>
          <p className="eyebrow">CONFIGURACIÓN REQUERIDA</p>
          <h1>Conecta Supabase para continuar</h1>
          <p>
            La operación real no usa datos temporales. Agrega las variables de
            Supabase y ejecuta las migraciones antes de entrar al dashboard.
          </p>
          <code>NEXT_PUBLIC_SUPABASE_URL</code>
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>
        </section>
      </main>
    );
  }

  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const snapshot = await getOperationsSnapshot(user.role);
  return <PersistentDashboard user={user} snapshot={snapshot} />;
}
