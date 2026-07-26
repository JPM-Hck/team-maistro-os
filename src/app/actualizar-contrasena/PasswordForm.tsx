"use client";

import { useActionState } from "react";
import { updatePassword, type PasswordState } from "./actions";

const initialState: PasswordState = { message: "" };

export function PasswordForm() {
  const [state, action, pending] = useActionState(
    updatePassword,
    initialState,
  );

  return (
    <form action={action} className="login-form">
      <div className="brand login-brand">
        <span className="brand-mark">M</span>
        <div>
          <strong>MAISTRO</strong>
          <small>OPERATIONS SYSTEM</small>
        </div>
      </div>
      <div>
        <p className="eyebrow">PRIMER ACCESO</p>
        <h1>Crea tu contraseña</h1>
        <p>Será la contraseña que usarás para entrar a Team Maistro OS.</p>
      </div>
      <label>
        Nueva contraseña
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </label>
      <label>
        Confirmar contraseña
        <input
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </label>
      {state.message && (
        <p className="form-message" role="alert">
          {state.message}
        </p>
      )}
      <button className="primary-button" disabled={pending}>
        {pending ? "Guardando…" : "Guardar y entrar"}
      </button>
      <small>Usa al menos 8 caracteres y no compartas tu contraseña.</small>
    </form>
  );
}
