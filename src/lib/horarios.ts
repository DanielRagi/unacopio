/**
 * Horarios estructurados y el cálculo de "abierto ahora".
 *
 * Se guarda en `puntos.horarios` como un arreglo de franjas. El día usa la misma
 * numeración que `Date.getDay()` —0 domingo, 6 sábado— para no tener que
 * traducir en cada lado.
 *
 *   [{ "dia": 1, "desde": "08:00", "hasta": "18:00" }, ...]
 *
 * Todo se calcula en hora de Colombia, no en la del servidor: el sitio se
 * despliega en Vercel y el reloj de esa máquina está en UTC. Colombia no cambia
 * de hora en todo el año, pero igual se resuelve con `Intl` y no con un -5 a
 * mano, para que no dependa de que eso siga siendo cierto.
 */

export interface Franja {
  /** 0 = domingo … 6 = sábado */
  dia: number;
  /** "HH:MM" en 24 horas */
  desde: string;
  hasta: string;
}

export const ZONA = 'America/Bogota';

export const DIAS = [
  { valor: 1, corto: 'Lun', largo: 'lunes' },
  { valor: 2, corto: 'Mar', largo: 'martes' },
  { valor: 3, corto: 'Mié', largo: 'miércoles' },
  { valor: 4, corto: 'Jue', largo: 'jueves' },
  { valor: 5, corto: 'Vie', largo: 'viernes' },
  { valor: 6, corto: 'Sáb', largo: 'sábado' },
  { valor: 0, corto: 'Dom', largo: 'domingo' },
] as const;

export function esFranja(valor: unknown): valor is Franja {
  if (typeof valor !== 'object' || valor === null) return false;
  const f = valor as Record<string, unknown>;
  return (
    typeof f.dia === 'number' && f.dia >= 0 && f.dia <= 6 &&
    typeof f.desde === 'string' && /^\d{2}:\d{2}$/.test(f.desde) &&
    typeof f.hasta === 'string' && /^\d{2}:\d{2}$/.test(f.hasta)
  );
}

/** Lo que venga de la base es `unknown` hasta que se compruebe. */
export function leerHorarios(valor: unknown): Franja[] | null {
  if (!Array.isArray(valor)) return null;
  const franjas = valor.filter(esFranja);
  return franjas.length > 0 ? franjas : null;
}

const aMinutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Día de la semana, minutos desde medianoche y fecha, en hora de Colombia. */
export function ahoraEnColombia(base: Date = new Date()) {
  const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const partes = Object.fromEntries(
    formato.formatToParts(base).map((p) => [p.type, p.value]),
  );

  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  // A medianoche algunos entornos devuelven 24 en vez de 00.
  const hora = Number(partes.hour) % 24;

  return {
    dia: dias[partes.weekday] ?? 0,
    minutos: hora * 60 + Number(partes.minute),
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
  };
}

export type EstadoApertura =
  | { estado: 'abierto'; cierraA: string }
  | { estado: 'cerrado'; abreEn: string | null }
  | null;

/**
 * ¿Está abierto en este momento?
 *
 * Devuelve `null` cuando el punto no tiene horario estructurado —los registros
 * viejos y los que cargó moderación a mano—. En ese caso no se muestra nada:
 * mejor callar que afirmar algo que no sabemos.
 */
export function estadoApertura(
  horarios: Franja[] | null,
  fechaInicio: string | null,
  fechaFin: string | null,
  base: Date = new Date(),
): EstadoApertura {
  if (!horarios || horarios.length === 0) return null;

  const ahora = ahoraEnColombia(base);

  // Fuera de las fechas de la campaña no hay horario que valga.
  if (fechaInicio && ahora.fecha < fechaInicio) return { estado: 'cerrado', abreEn: null };
  if (fechaFin && ahora.fecha > fechaFin) return { estado: 'cerrado', abreEn: null };

  const deHoy = horarios.filter((f) => f.dia === ahora.dia);
  const abierta = deHoy.find(
    (f) => ahora.minutos >= aMinutos(f.desde) && ahora.minutos < aMinutos(f.hasta),
  );
  if (abierta) return { estado: 'abierto', cierraA: hora12(abierta.hasta) };

  // Lo que falta abrir hoy.
  const luegoHoy = deHoy
    .filter((f) => aMinutos(f.desde) > ahora.minutos)
    .sort((a, b) => aMinutos(a.desde) - aMinutos(b.desde))[0];
  if (luegoHoy) return { estado: 'cerrado', abreEn: `hoy a las ${hora12(luegoHoy.desde)}` };

  // Y si no, el próximo día que abra, mirando una semana hacia adelante.
  for (let salto = 1; salto <= 7; salto++) {
    const dia = (ahora.dia + salto) % 7;
    const franja = horarios
      .filter((f) => f.dia === dia)
      .sort((a, b) => aMinutos(a.desde) - aMinutos(b.desde))[0];
    if (franja) {
      const nombre = salto === 1 ? 'mañana' : DIAS.find((d) => d.valor === dia)?.largo ?? '';
      return { estado: 'cerrado', abreEn: `${nombre} a las ${hora12(franja.desde)}` };
    }
  }

  return { estado: 'cerrado', abreEn: null };
}

/** "08:00" → "8:00 a.m." · "13:30" → "1:30 p.m." · "12:00" → "12:00 m." */
export function hora12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const minutos = String(m).padStart(2, '0');
  if (h === 12 && m === 0) return '12:00 m.';
  const sufijo = h < 12 ? 'a.m.' : 'p.m.';
  const hora12h = h % 12 === 0 ? 12 : h % 12;
  return `${hora12h}:${minutos} ${sufijo}`;
}

/**
 * Texto legible a partir de las franjas: "Lunes a sábado de 8:00 a.m. a
 * 6:00 p.m.".
 *
 * Se genera en vez de pedirlo aparte para que no puedan contradecirse. Un punto
 * con el horario escrito de una forma y estructurado de otra es peor que uno
 * sin horario: el badge diría una cosa y el texto otra.
 */
export function textoHorario(horarios: Franja[]): string {
  // `number[]` y no la unión literal de DIAS: acá se compara contra días que
  // vienen de la base, donde el tipo es simplemente número.
  const orden: number[] = DIAS.map((d) => d.valor);

  // Agrupa los días que comparten exactamente el mismo juego de franjas.
  const porDia = new Map<number, string>();
  for (const dia of orden) {
    const franjas = horarios
      .filter((f) => f.dia === dia)
      .sort((a, b) => aMinutos(a.desde) - aMinutos(b.desde))
      .map((f) => `${f.desde}-${f.hasta}`)
      .join(', ');
    if (franjas) porDia.set(dia, franjas);
  }
  if (porDia.size === 0) return '';

  const bloques: { dias: number[]; franjas: string }[] = [];
  for (const dia of orden) {
    const franjas = porDia.get(dia);
    if (!franjas) continue;
    const ultimo = bloques.at(-1);
    // Solo se juntan si son días seguidos en el orden de la semana.
    const seguido = ultimo && orden.indexOf(dia) === orden.indexOf(ultimo.dias.at(-1)!) + 1;
    if (ultimo && ultimo.franjas === franjas && seguido) ultimo.dias.push(dia);
    else bloques.push({ dias: [dia], franjas });
  }

  const nombre = (dia: number) => DIAS.find((d) => d.valor === dia)!.largo;

  return bloques
    .map(({ dias, franjas }) => {
      const etiqueta =
        dias.length === 1 ? nombre(dias[0])
          : dias.length === 2 ? `${nombre(dias[0])} y ${nombre(dias[1])}`
            : `${nombre(dias[0])} a ${nombre(dias.at(-1)!)}`;
      const horas = franjas
        .split(', ')
        .map((r) => {
          const [desde, hasta] = r.split('-');
          return `de ${hora12(desde)} a ${hora12(hasta)}`;
        })
        .join(' y ');
      return `${etiqueta} ${horas}`;
    })
    .join('; ')
    .replace(/^./, (c) => c.toUpperCase());
}
