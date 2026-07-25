"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { message: "" };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="login-form">
      <div className="brand login-brand">
        <span className="brand-mark">M</span>
        <div><strong>MAISTRO</strong><small>OPERATIONS SYSTEM</small></div>
      </div>
      <div>
        <p className="eyebrow">ACCESO OPERATIVO</p>
        <h1>Bienvenido de vuelta</h1>
        <p>Ingresa con el usuario asignado por administración.</p>
      </div>
      <label>
        Correo
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required minLength={6} />
      </label>
      {state.message && <p className="form-message" role="alert">{state.message}</p>}
      <button className="primary-button" disabled={pending}>
        {pending ? "Validando…" : "Entrar a Team Maistro"}
      </button>
      <small>Roles disponibles: administrador, supervisor y almacén.</small>
    </form>
  );
}
