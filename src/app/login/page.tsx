import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section>
        <p className="eyebrow">UNA SOLA FUENTE DE VERDAD</p>
        <h2>Obra, recursos y decisiones conectadas.</h2>
        <p>
          Controla tareas, inventario, compras y responsables sin depender de notas dispersas.
        </p>
      </section>
      <LoginForm />
    </main>
  );
}
