import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="login-page">
      <section>
        <p className="eyebrow">ACCESO SEGURO</p>
        <h2>El enlace ya no es válido.</h2>
        <p>
          Las invitaciones expiran por seguridad. Solicita una nueva desde el
          panel de administración de Supabase.
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
          <p className="eyebrow">INVITACIÓN NO DISPONIBLE</p>
          <h1>Volvamos a intentarlo</h1>
          <p>Abre la invitación más reciente que recibiste por correo.</p>
        </div>
        <Link className="primary-button auth-link" href="/login">
          Ir al inicio de sesión
        </Link>
      </div>
    </main>
  );
}
