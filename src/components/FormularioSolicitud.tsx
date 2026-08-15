'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { enviarSolicitud } from '@/app/punto/[id]/solicitud/acciones';
import { SOLICITUD_INICIAL } from '@/lib/estados';

const MOTIVOS = [
  {
    valor: 'info_incorrecta',
    titulo: 'Hay que corregir algo',
    ayuda: 'Cambió el horario, la dirección, el teléfono o lo que están recibiendo.',
  },
  {
    valor: 'cerrado',
    titulo: 'Ya no está recibiendo',
    ayuda: 'El punto cerró o terminó la campaña. Lo quitamos del directorio.',
  },
  {
    valor: 'no_existe',
    titulo: 'Este punto no existe',
    ayuda: 'Fui y no había nada, o la información es falsa.',
  },
  {
    valor: 'duplicado',
    titulo: 'Está repetido',
    ayuda: 'Ya hay otra ficha del mismo punto.',
  },
] as const;

export function FormularioSolicitud({
  puntoId,
  nombrePunto,
}: {
  puntoId: string;
  nombrePunto: string;
}) {
  const [estado, enviar, enviando] = useActionState(enviarSolicitud, SOLICITUD_INICIAL);

  if (estado.estado === 'enviada') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5">
          <p className="font-semibold">Recibimos tu solicitud</p>
          <p className="text-sm text-black/70 dark:text-white/70">
            Moderación la va a revisar y, si hace falta, te llama para confirmar
            antes de cambiar algo. Gracias: mantener esto al día es lo que hace
            que la gente no pierda el viaje.
          </p>
        </div>
        <Link
          href={`/punto/${puntoId}`}
          className="self-start rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          Volver al punto
        </Link>
      </div>
    );
  }

  return (
    <form action={enviar} className="flex flex-col gap-7">
      <input type="hidden" name="punto_id" value={puntoId} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">¿De qué se trata?</legend>
        {MOTIVOS.map((motivo, i) => (
          <label
            key={motivo.valor}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-black/10 p-3 has-checked:border-black/40 has-checked:bg-black/[0.03] dark:border-white/15 dark:has-checked:border-white/50 dark:has-checked:bg-white/5"
          >
            <input
              type="radio"
              name="tipo"
              value={motivo.valor}
              defaultChecked={i === 0}
              className="mt-1 size-4"
            />
            <span className="flex flex-col">
              <span className="font-medium">{motivo.titulo}</span>
              <span className="text-sm text-black/60 dark:text-white/60">{motivo.ayuda}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Observaciones</span>
        <span className="text-sm text-black/60 dark:text-white/60">
          Escríbelo como se lo contarías a alguien por teléfono. Entre más
          concreto, más rápido lo aplicamos.
        </span>
        <textarea
          name="observaciones"
          required
          rows={5}
          minLength={10}
          maxLength={1000}
          placeholder="Ahora cerramos a las 4pm y ya no necesitamos ropa, pero sí agua y pañales."
          className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-base dark:border-white/20"
        />
      </label>

      <label className="flex items-start gap-2.5 rounded-lg bg-black/[0.03] p-3 dark:bg-white/5">
        <input type="checkbox" name="es_responsable" className="mt-0.5 size-4" />
        <span className="text-sm">
          Soy quien organiza <strong>{nombrePunto}</strong>. Marcar esto ayuda a
          que moderación le dé prioridad y no lo trate como una queja de un
          tercero.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          Tu nombre y teléfono{' '}
          <span className="font-normal text-black/50 dark:text-white/50">(opcional)</span>
        </span>
        <span className="text-sm text-black/60 dark:text-white/60">
          No se publica. Sirve para llamarte si queda alguna duda.
        </span>
        <input
          name="contacto"
          maxLength={160}
          className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-base dark:border-white/20"
        />
      </label>

      <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      {estado.estado === 'error' && (
        <p className="text-sm font-medium text-red-700 dark:text-red-400">{estado.mensaje}</p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg bg-emerald-700 px-6 py-3.5 text-base font-semibold text-white disabled:opacity-60 dark:bg-emerald-600"
      >
        {enviando ? 'Enviando…' : 'Enviar la solicitud'}
      </button>
    </form>
  );
}
