/**
 * Pruebas del cálculo de "abierto ahora".
 *
 *   npm run probar:horarios
 *
 * Sin framework de pruebas a propósito: es un archivo, corre con node y no le
 * mete una dependencia más al proyecto. Node 24 ejecuta TypeScript directamente.
 *
 * Las fechas se escriben en UTC y los casos se piensan en hora de Colombia
 * (UTC-5), que es justo lo que hay que verificar: el servidor está en UTC y el
 * horario del punto es local. 2026-08-17 es lunes.
 */
import {
  estadoApertura, hora12, textoHorario, type Franja,
} from '../src/lib/horarios.ts';

let fallas = 0;

function igual(caso: string, obtenido: unknown, esperado: unknown) {
  const a = JSON.stringify(obtenido);
  const b = JSON.stringify(esperado);
  if (a === b) {
    console.log(`  ok   ${caso}`);
  } else {
    console.log(`  FALLA ${caso}\n         esperado: ${b}\n         obtenido: ${a}`);
    fallas++;
  }
}

const lunASab: Franja[] = [1, 2, 3, 4, 5, 6].map((dia) => ({ dia, desde: '08:00', hasta: '18:00' }));

const partido: Franja[] = [
  { dia: 1, desde: '08:00', hasta: '12:00' },
  { dia: 1, desde: '14:00', hasta: '18:00' },
];

const enUtc = (iso: string) => new Date(iso);

console.log('\nestadoApertura — lunes a sábado, 8:00 a 18:00');
igual('lunes 10:00 en Colombia → abierto',
  estadoApertura(lunASab, null, null, enUtc('2026-08-17T15:00:00Z')),
  { estado: 'abierto', cierraA: '6:00 p.m.' });

igual('lunes 07:00 → cerrado, abre hoy',
  estadoApertura(lunASab, null, null, enUtc('2026-08-17T12:00:00Z')),
  { estado: 'cerrado', abreEn: 'hoy a las 8:00 a.m.' });

igual('lunes 18:00 en punto → ya cerró',
  estadoApertura(lunASab, null, null, enUtc('2026-08-17T23:00:00Z')),
  { estado: 'cerrado', abreEn: 'mañana a las 8:00 a.m.' });

igual('domingo 10:00 → cerrado, abre mañana',
  estadoApertura(lunASab, null, null, enUtc('2026-08-16T15:00:00Z')),
  { estado: 'cerrado', abreEn: 'mañana a las 8:00 a.m.' });

console.log('\nzona horaria');
igual('lunes 02:00 UTC es domingo 21:00 en Colombia → cerrado',
  estadoApertura(lunASab, null, null, enUtc('2026-08-17T02:00:00Z')),
  { estado: 'cerrado', abreEn: 'mañana a las 8:00 a.m.' });

igual('lunes 13:00 UTC es lunes 08:00 en Colombia → abierto',
  estadoApertura(lunASab, null, null, enUtc('2026-08-17T13:00:00Z')),
  { estado: 'abierto', cierraA: '6:00 p.m.' });

console.log('\njornada partida');
igual('lunes 13:00 local, entre las dos jornadas → abre hoy a las 2:00 p.m.',
  estadoApertura(partido, null, null, enUtc('2026-08-17T18:00:00Z')),
  { estado: 'cerrado', abreEn: 'hoy a las 2:00 p.m.' });

igual('lunes 09:00 local → abierto hasta las 12:00 m.',
  estadoApertura(partido, null, null, enUtc('2026-08-17T14:00:00Z')),
  { estado: 'abierto', cierraA: '12:00 m.' });

igual('martes, con horario solo de lunes → abre el lunes que viene',
  estadoApertura(partido, null, null, enUtc('2026-08-18T15:00:00Z')),
  { estado: 'cerrado', abreEn: 'lunes a las 8:00 a.m.' });

console.log('\nsin horario estructurado');
igual('null → no se muestra nada', estadoApertura(null, null, null, enUtc('2026-08-17T15:00:00Z')), null);
igual('arreglo vacío → tampoco', estadoApertura([], null, null, enUtc('2026-08-17T15:00:00Z')), null);

console.log('\nfechas de campaña');
igual('la campaña ya terminó → cerrado sin próxima apertura',
  estadoApertura(lunASab, null, '2026-08-10', enUtc('2026-08-17T15:00:00Z')),
  { estado: 'cerrado', abreEn: null });

igual('la campaña todavía no empieza → cerrado',
  estadoApertura(lunASab, '2026-09-01', null, enUtc('2026-08-17T15:00:00Z')),
  { estado: 'cerrado', abreEn: null });

igual('dentro de las fechas → abierto normal',
  estadoApertura(lunASab, '2026-08-01', '2026-08-31', enUtc('2026-08-17T15:00:00Z')),
  { estado: 'abierto', cierraA: '6:00 p.m.' });

console.log('\nhora12');
igual('00:00', hora12('00:00'), '12:00 a.m.');
igual('08:05', hora12('08:05'), '8:05 a.m.');
igual('12:00', hora12('12:00'), '12:00 m.');
igual('12:30', hora12('12:30'), '12:30 p.m.');
igual('13:05', hora12('13:05'), '1:05 p.m.');
igual('23:59', hora12('23:59'), '11:59 p.m.');

console.log('\ntextoHorario');
igual('lunes a sábado seguidos se agrupan',
  textoHorario(lunASab), 'Lunes a sábado de 8:00 a.m. a 6:00 p.m.');

igual('días sueltos no se agrupan',
  textoHorario([1, 3, 5].map((dia) => ({ dia, desde: '09:00', hasta: '13:00' }))),
  'Lunes de 9:00 a.m. a 1:00 p.m.; miércoles de 9:00 a.m. a 1:00 p.m.; viernes de 9:00 a.m. a 1:00 p.m.');

igual('dos días seguidos usan "y"',
  textoHorario([{ dia: 6, desde: '08:00', hasta: '12:00' }, { dia: 0, desde: '08:00', hasta: '12:00' }]),
  'Sábado y domingo de 8:00 a.m. a 12:00 m.');

igual('jornada partida',
  textoHorario(partido), 'Lunes de 8:00 a.m. a 12:00 m. y de 2:00 p.m. a 6:00 p.m.');

igual('el domingo va al final, no se pega con el lunes',
  textoHorario([{ dia: 0, desde: '08:00', hasta: '18:00' }, { dia: 1, desde: '08:00', hasta: '18:00' }]),
  'Lunes de 8:00 a.m. a 6:00 p.m.; domingo de 8:00 a.m. a 6:00 p.m.');


/*
 * La fecha de cierre manda, aunque no haya horario.
 *
 * Este bloque existe por un fallo real: durante días, los puntos importados
 * —que nunca traen franjas— siguieron viéndose como abiertos después de su
 * fecha de cierre, porque la función devolvía `null` antes de mirar las
 * fechas. Un acopio que cerró el martes se veía igual que uno abierto.
 */
console.log('\nestadoApertura — fechas de campaña sin horario cargado');

igual('sin horario y con fecha de cierre pasada → cerrado',
  estadoApertura(null, null, '2026-08-17', enUtc('2026-08-21T15:00:00Z')),
  { estado: 'cerrado', abreEn: null });

igual('sin horario y con fecha de cierre futura → no se afirma nada',
  estadoApertura(null, null, '2026-08-31', enUtc('2026-08-21T15:00:00Z')),
  null);

igual('el último día todavía cuenta',
  estadoApertura(null, null, '2026-08-21', enUtc('2026-08-21T15:00:00Z')),
  null);

igual('sin horario y antes de empezar → cerrado',
  estadoApertura(null, '2026-08-25', null, enUtc('2026-08-21T15:00:00Z')),
  { estado: 'cerrado', abreEn: null });

igual('sin horario y sin fechas → no se afirma nada',
  estadoApertura(null, null, null, enUtc('2026-08-21T15:00:00Z')),
  null);

igual('la fecha de cierre pasada le gana al horario de hoy',
  estadoApertura(lunASab, null, '2026-08-17', enUtc('2026-08-21T15:00:00Z')),
  { estado: 'cerrado', abreEn: null });

console.log(fallas === 0 ? '\n✓ todo bien' : `\n✗ ${fallas} falla(s)`);
process.exit(fallas === 0 ? 0 : 1);
