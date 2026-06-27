"use client";

import { useActionState } from "react";
import { iniciarSesion, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";

const estadoInicial: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(iniciarSesion, estadoInicial);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-xl border border-border bg-white p-8 shadow-sm"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-accent" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">EM-Pedidos</h1>
        </div>

        <label className="mb-1 block text-sm text-ink-2" htmlFor="email">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mb-4 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus"
        />

        <label className="mb-1 block text-sm text-ink-2" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mb-5 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus"
        />

        {state.error && (
          <p className="mb-4 text-sm text-accent">{state.error}</p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>
    </main>
  );
}
