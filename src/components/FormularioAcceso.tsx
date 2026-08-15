'use client';

import { useActionState } from 'react';
import { enviarEnlaceAcceso } from '@/app/admin/acciones';
import { ACCESO_INICIAL } from '@/lib/estados';
import { SITIO } from '@/lib/textos';

export function FormularioAcceso() {
  const [estado, enviar, enviando] = useActionState(enviarEnlaceAcceso, ACCESO_INICIAL);

  if (estado.estado === 'enviado') {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5">
        <p className="font-semibold">Revisa tu correo</p>
        <p className="text-sm text-black/70 dark:text-white/70">
          Le mandamos un enlace de acceso a <strong>{estado.correo}</strong>. Se
          abre una sola vez y desde este mismo dispositivo.
        </p>
        <p className="text-sm text-black/60 dark:text-white/60">
          Llega de <strong>{SITIO.correo}</strong>. Si no aparece en unos
          minutos, mira en spam y escríbenos a esa misma dirección.
        </p>
      </div>
    );
  }

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Correo del equipo</span>
        <input
          name="correo"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-base dark:border-white/20"
        />
      </label>

      {estado.estado === 'error' && (
        <p className="text-sm font-medium text-red-700 dark:text-red-400">{estado.mensaje}</p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {enviando ? 'Enviando…' : 'Enviarme el enlace'}
      </button>

      <p className="text-sm text-black/60 dark:text-white/60">
        No hay contraseñas. El acceso llega por correo, y solo funciona para
        cuentas que ya estén creadas en el proyecto.
      </p>
    </form>
  );
}
