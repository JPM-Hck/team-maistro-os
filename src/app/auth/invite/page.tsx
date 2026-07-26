"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InvitePage() {
  const router = useRouter();
  const [message, setMessage] = useState("Validando tu invitación…");

  useEffect(() => {
    let active = true;

    async function acceptInvite() {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const errorDescription = params.get("error_description");

      if (errorDescription) {
        if (active) {
          setMessage(
            "La invitación expiró o ya fue utilizada. Solicita una invitación nueva.",
          );
        }
        return;
      }

      const supabase = createClient();
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          if (active) setMessage("No se pudo validar la invitación.");
          return;
        }
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (active) setMessage("El enlace de invitación no es válido.");
          return;
        }
      }

      window.history.replaceState(null, "", "/auth/invite");
      router.replace("/actualizar-contrasena");
      router.refresh();
    }

    void acceptInvite();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="login-page">
      <section>
        <p className="eyebrow">ACCESO SEGURO</p>
        <h2>Estamos preparando tu cuenta.</h2>
        <p>
          Team Maistro OS está verificando el enlace antes de permitirte crear
          una contraseña.
        </p>
      </section>
      <div className="login-form">
        <div className="brand login-brand">
          <span className="brand-mark">M</span>
          <div>
            <strong>MAISTRO</strong>
            <small>OPERATIONS SYSTEM</small>
          </div>
        </div>
        <div>
          <p className="eyebrow">INVITACIÓN</p>
          <h1>Confirmando acceso</h1>
          <p role="status">{message}</p>
        </div>
        <Link className="text-button auth-link" href="/login">
          Volver al inicio de sesión
        </Link>
      </div>
    </main>
  );
}
