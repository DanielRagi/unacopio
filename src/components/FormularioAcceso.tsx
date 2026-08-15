'use client';

import { useActionState, useState } from 'react';
import { enviarEnlaceAcceso, verificarCodigo } from '@/app/admin/acciones';
import { ACCESO_INICIAL } from '@/lib/estados';
import { SITIO } from '@/lib/textos';

/**
 * Acceso a moderación. Un correo, dos formas de entrar.
 *
 * El enlace es la cómoda; el código de seis dígitos es la que siempre funciona.
 * Se ofrecen los dos porque el enlace falla por cosas que no controlamos —el
 * antivirus del correo lo abre y lo gasta, o la persona lo abre en otro
 * navegador— y todas esas fallas se ven igual desde afuera.
 */
export function FormularioAcceso() {
  const [estado, enviar, enviando] = useActionState(enviarEnlaceAcceso, ACCESO_INICIAL);
  const [estadoCodigo, verificar, verificando] = useActionState(verificarCodigo, ACCESO_INICIAL);
  const [escribiendoCodigo, setEscribiendoCodigo] = useState(false);

  const correo =
    (estadoCodigo.estado === 'codigo' && estadoCodigo.correo) ||
    (estado.estado === 'enviado' && estado.correo) ||
    '';

  const errorCodigo = estadoCodigo.estado === 'codigo' ? estadoCodigo.mensaje : undefined;
  const enElPaso2 =
    escribiendoCodigo || estado.estado === 'enviado' || estadoCodigo.estado === 'codigo';

  if (enElPaso2) {
    return (
      <div className="flex flex-col gap-5">
        {correo !== '' && (
          <div className="flex flex-col gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5">
            <p className="font-semibold">Revisa tu correo</p>
            <p className="text-sm text-black/70 dark:text-white/70">
              Le mandamos a <strong>{correo}</strong> un enlace y un código de
              seis dígitos. Sirve cualquiera de los dos.
            </p>
            <p className="text-sm text-black/60 dark:text-white/60">
              Llega de <strong>{SITIO.correo}</strong>. Si no aparece en unos
              minutos, mira en spam y escríbenos a esa misma dirección.
            </p>
          </div>
        )}

        <form action={verificar} className="flex flex-col gap-3">
          {/* Si venimos de pedir el enlace ya sabemos el correo; si la persona
              llegó directo a escribir un código, hay que preguntárselo: el
              código solo vale junto al correo al que se mandó. */}
          {correo !== '' ? (
            <input type="hidden" name="correo" value={correo} />
          ) : (
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
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Código de seis dígitos</span>
            <span className="text-sm text-black/60 dark:text-white/60">
              Si el enlace no te sirvió, escribe el código. Es el camino que
              funciona aunque el antivirus del correo se haya comido el enlace.
            </span>
            <input
              name="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]*"
              placeholder="123456"
              className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-center font-mono text-2xl tracking-[0.4em] dark:border-white/20"
            />
          </label>

          {errorCodigo && (
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{errorCodigo}</p>
          )}

          <button
            type="submit"
            disabled={verificando}
            className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {verificando ? 'Entrando…' : 'Entrar con el código'}
          </button>
        </form>

        <a href="/admin" className="self-start text-sm underline underline-offset-4">
          Volver a pedir el enlace
        </a>
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

      <button
        type="button"
        onClick={() => setEscribiendoCodigo(true)}
        className="self-start text-sm underline underline-offset-4"
      >
        Ya tengo un código de seis dígitos
      </button>
    </form>
  );
}
