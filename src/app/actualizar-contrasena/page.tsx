import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./PasswordForm";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="login-page">
      <section>
        <p className="eyebrow">CUENTA ADMINISTRATIVA</p>
        <h2>Tu operación empieza protegida.</h2>
        <p>
          La primera cuenta queda vinculada como administrador y podrá gestionar
          proyectos, personal, inventario y nómina.
        </p>
      </section>
      <PasswordForm />
    </main>
  );
}
