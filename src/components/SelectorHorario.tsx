'use client';

import { useState } from 'react';
import { DIAS, type Franja } from '@/lib/horarios';

/**
 * Días y horas de atención.
 *
 * Casi todos los puntos abren a la misma hora todos los días que abren, así que
 * lo normal es marcar los días y poner un rango. Quien tenga jornada partida o
 * un sábado distinto puede abrir el modo detallado, pero no se le cobra esa
 * complejidad a los demás.
 *
 * El horario en texto lo genera el servidor a partir de esto, para que no puedan
 * contradecirse: un punto donde el texto dice una cosa y el badge "abierto
 * ahora" dice otra es peor que uno sin horario.
 */

type PorDia = Record<number, { abre: boolean; desde: string; hasta: string }>;

const POR_DEFECTO: PorDia = Object.fromEntries(
  DIAS.map((d) => [d.valor, { abre: d.valor !== 0, desde: '08:00', hasta: '18:00' }]),
);

/** Reconstruye el estado del selector a partir de lo que ya está guardado. */
function desdeFranjas(franjas: Franja[]): PorDia {
  return Object.fromEntries(
    DIAS.map((d) => {
      const suya = franjas.find((f) => f.dia === d.valor);
      return [
        d.valor,
        suya
          ? { abre: true, desde: suya.desde, hasta: suya.hasta }
          : { abre: false, desde: '08:00', hasta: '18:00' },
      ];
    }),
  );
}

export function SelectorHorario({ franjas: iniciales }: { franjas?: Franja[] }) {
  const dias0 = iniciales?.length ? desdeFranjas(iniciales) : POR_DEFECTO;

  // Si los días guardados no comparten el mismo rango, hay que abrir el modo
  // detallado de una vez: si no, editar el horario lo aplanaría sin avisar.
  const abiertos = iniciales?.length ? iniciales : [];
  const rangosDistintos = abiertos.some(
    (f) => f.desde !== abiertos[0].desde || f.hasta !== abiertos[0].hasta,
  );

  const [detallado, setDetallado] = useState(rangosDistintos);
  const [dias, setDias] = useState<PorDia>(dias0);
  const [desde, setDesde] = useState(abiertos[0]?.desde ?? '08:00');
  const [hasta, setHasta] = useState(abiertos[0]?.hasta ?? '18:00');

  const alternarDia = (valor: number) =>
    setDias((previo) => ({
      ...previo,
      [valor]: { ...previo[valor], abre: !previo[valor].abre },
    }));

  const cambiarDia = (valor: number, campo: 'desde' | 'hasta', hora: string) =>
    setDias((previo) => ({ ...previo, [valor]: { ...previo[valor], [campo]: hora } }));

  // En modo simple todos los días abiertos comparten el rango de arriba.
  const franjas = DIAS.filter((d) => dias[d.valor].abre).map((d) => ({
    dia: d.valor,
    desde: detallado ? dias[d.valor].desde : desde,
    hasta: detallado ? dias[d.valor].hasta : hasta,
  }));

  const claseHora =
    'rounded-lg border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20';

  return (
    <div className="flex flex-col gap-4">
      {/* Lo que viaja al servidor. Un solo campo: el resto es interfaz. */}
      <input type="hidden" name="horarios" value={JSON.stringify(franjas)} />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">¿Qué días atienden?</span>
        <div className="flex flex-wrap gap-1.5">
          {DIAS.map((d) => (
            <label key={d.valor} className="cursor-pointer">
              <input
                type="checkbox"
                checked={dias[d.valor].abre}
                onChange={() => alternarDia(d.valor)}
                className="peer sr-only"
              />
              <span className="block rounded-lg border border-black/15 px-3 py-2 text-sm peer-checked:bg-emerald-600 peer-checked:font-semibold peer-checked:text-white dark:border-white/20">
                {d.corto}
              </span>
            </label>
          ))}
        </div>
      </div>

      {!detallado ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Abren a las</span>
            <input
              type="time"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className={claseHora}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Cierran a las</span>
            <input
              type="time"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className={claseHora}
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {DIAS.filter((d) => dias[d.valor].abre).map((d) => (
            <div key={d.valor} className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-sm">{d.corto}</span>
              <input
                type="time"
                value={dias[d.valor].desde}
                onChange={(e) => cambiarDia(d.valor, 'desde', e.target.value)}
                className={claseHora}
              />
              <span className="text-sm opacity-60">a</span>
              <input
                type="time"
                value={dias[d.valor].hasta}
                onChange={(e) => cambiarDia(d.valor, 'hasta', e.target.value)}
                className={claseHora}
              />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setDetallado((v) => !v)}
        className="self-start text-sm underline underline-offset-4"
      >
        {detallado ? 'Usar el mismo horario todos los días' : 'Poner un horario distinto por día'}
      </button>

      {franjas.length === 0 && (
        <p className="text-sm font-medium text-red-700 dark:text-red-400">
          Marca al menos un día de atención.
        </p>
      )}
    </div>
  );
}
