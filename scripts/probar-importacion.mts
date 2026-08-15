/**
 * Pruebas del parser de CSV y de la revisión fila por fila.
 *
 *   npm run probar:importacion
 *
 * Es código que se equivoca callado: un separador mal detectado no revienta,
 * solo mete cuarenta puntos con la dirección en el campo del nombre. Mejor que
 * falle ruidoso acá.
 */
import {
  parsearCsv, revisarFilas, normalizar,
  type CatalogosImportacion,
} from '../src/lib/importacion.ts';

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

const CATALOGOS: CatalogosImportacion = {
  municipios: [
    { codigo: '05001', nombre: 'Medellín', departamento_codigo: '05', lat: 6.2576, lng: -75.6114 },
    { codigo: '11001', nombre: 'Bogotá D.C.', departamento_codigo: '11', lat: 4.6486, lng: -74.2478 },
    // El mismo nombre en dos departamentos: es lo que obliga al código DANE.
    { codigo: '05055', nombre: 'Argelia', departamento_codigo: '05', lat: 5.73, lng: -75.14 },
    { codigo: '19050', nombre: 'Argelia', departamento_codigo: '19', lat: 2.25, lng: -77.24 },
    // Sin centroide: no se puede rellenar la coordenada.
    { codigo: '99999', nombre: 'Sin Centro', departamento_codigo: '99', lat: null, lng: null },
  ],
  categorias: new Set(['agua_embotellada', 'panales', 'ropa_usada_buen_estado']),
  etiquetasDeTipo: {
    alcaldia: 'Alcaldía',
    fundacion: 'Fundación',
    particular: 'Persona natural',
  },
};

console.log('\nnormalizar');
igual('quita tildes', normalizar('Medellín'), 'medellin');
igual('colapsa signos', normalizar('Bogotá D.C.'), 'bogota d c');

console.log('\nparsearCsv');
{
  const { columnas, filas } = parsearCsv('nombre,direccion\nUno,Calle 1\nDos,Calle 2\n');
  igual('columnas', columnas, ['nombre', 'direccion']);
  igual('dos filas', filas.length, 2);
  igual('la numeración cuenta el encabezado', filas[0].numero, 2);
  igual('valores', filas[1].valores, { nombre: 'Dos', direccion: 'Calle 2' });
}

{
  // Excel en español exporta con punto y coma. Si no se detecta, todo el
  // registro cae en la primera columna y nada cuadra.
  const { columnas, filas } = parsearCsv('nombre;direccion;municipio\nUno;Calle 1;Medellín\n');
  igual('detecta el punto y coma', columnas, ['nombre', 'direccion', 'municipio']);
  igual('y separa bien', filas[0].valores.direccion, 'Calle 1');
}

{
  const { filas } = parsearCsv(
    'nombre,direccion\r\n"Parroquia ""San José""","Calle 12 # 4-30, al lado del parque"\r\n',
  );
  igual('comillas escapadas', filas[0].valores.nombre, 'Parroquia "San José"');
  igual('coma dentro de comillas', filas[0].valores.direccion, 'Calle 12 # 4-30, al lado del parque');
}

{
  const { filas } = parsearCsv('nombre,notas\nUno,"Primera línea\nsegunda línea"\n');
  igual('salto de línea dentro de una celda', filas.length, 1);
  igual('y se conserva', filas[0].valores.notas, 'Primera línea\nsegunda línea');
}

{
  const { columnas } = parsearCsv('﻿Nombre del punto,Dirección\nUno,Calle 1\n');
  igual('BOM y encabezados con tilde y espacio', columnas, ['nombre_del_punto', 'direccion']);
}

igual('archivo vacío', parsearCsv('   ').filas.length, 0);

{
  const { filas } = parsearCsv('nombre,direccion\nUno,Calle 1\n,,\n\nDos,Calle 2\n');
  igual('las filas en blanco se ignoran', filas.length, 2);
}

console.log('\nrevisarFilas');
{
  const { filas } = parsearCsv(
    [
      'nombre,tipo,municipio_codigo,direccion,lat,lng,telefono,urgente,no_recibe,fuente',
      'Coliseo,Alcaldía,05001,Carrera 74 # 48-10,6.2568,-75.5906,3001112233,agua_embotellada;panales,ropa_usada_buen_estado,Alcaldía de Medellín',
    ].join('\n'),
  );
  const [fila] = revisarFilas(filas, CATALOGOS);

  igual('sin errores', fila.errores, []);
  igual('sin advertencias', fila.advertencias, []);
  igual('municipio por código', fila.punto?.municipio_codigo, '05001');
  igual('departamento deducido', fila.punto?.departamento_codigo, '05');
  igual('tipo por etiqueta con tilde', fila.punto?.tipo_organizacion, 'alcaldia');
  igual('categorías con nivel', fila.punto?.categorias, [
    { slug: 'agua_embotellada', nivel: 'alta' },
    { slug: 'panales', nivel: 'alta' },
    { slug: 'ropa_usada_buen_estado', nivel: 'no_recibe' },
  ]);
  igual('la fuente se guarda', fila.punto?.fuente_nombre, 'Alcaldía de Medellín');
}

{
  const { filas } = parsearCsv('nombre,municipio,direccion\nUno,MEDELLIN,Calle 1\n');
  const [fila] = revisarFilas(filas, CATALOGOS);
  igual('municipio por nombre sin tildes ni mayúsculas', fila.punto?.municipio_codigo, '05001');
  igual('cae al centroide', [fila.punto?.lat, fila.punto?.lng], [6.2576, -75.6114]);
  igual(
    'y lo avisa',
    fila.advertencias.some((a) => a.includes('centro del municipio')),
    true,
  );
}

{
  const { filas } = parsearCsv('nombre,municipio,direccion\nUno,Argelia,Calle 1\n');
  const [fila] = revisarFilas(filas, CATALOGOS);
  igual('nombre ambiguo se rechaza', fila.punto, undefined);
  igual(
    'y dice por qué',
    fila.errores.some((e) => e.includes('2 departamentos')),
    true,
  );
}

{
  const { filas } = parsearCsv(
    'nombre,municipio_codigo,direccion,lat,lng\nUno,05001,Calle 1,"40,7","-74,0"\n',
  );
  const [fila] = revisarFilas(filas, CATALOGOS);
  igual('coordenada fuera de Colombia', fila.punto, undefined);
  igual(
    'con coma decimal leída bien',
    fila.errores.some((e) => e.includes('(40.7, -74)')),
    true,
  );
}

{
  const { filas } = parsearCsv('nombre,municipio_codigo,direccion\nUno,99999,Calle 1\n');
  const [fila] = revisarFilas(filas, CATALOGOS);
  igual('sin centroide y sin coordenadas', fila.punto, undefined);
}

{
  const { filas } = parsearCsv('nombre,municipio_codigo,direccion\n,05001,\n');
  const [fila] = revisarFilas(filas, CATALOGOS);
  igual('faltan nombre y dirección', fila.errores.length, 2);
  igual('el nombre vacío se muestra', fila.nombre, '(sin nombre)');
}

{
  const { filas } = parsearCsv(
    'nombre,municipio_codigo,direccion,recibe,tipo\nUno,05001,Calle 1,arroz;agua_embotellada,Fundación Equis\n',
  );
  const [fila] = revisarFilas(filas, CATALOGOS);
  igual('la categoría inventada se ignora', fila.punto?.categorias, [
    { slug: 'agua_embotellada', nivel: 'si' },
  ]);
  igual(
    'y se avisa',
    fila.advertencias.some((a) => a.includes('arroz')),
    true,
  );
  igual('tipo desconocido cae en particular', fila.punto?.tipo_organizacion, 'particular');
}

{
  // Un punto que en `necesita_urgente` y en `recibe` trae lo mismo: gana el
  // primero, que es el más específico.
  const { filas } = parsearCsv(
    'nombre,municipio_codigo,direccion,urgente,recibe\nUno,05001,Calle 1,agua_embotellada,agua_embotellada\n',
  );
  const [fila] = revisarFilas(filas, CATALOGOS);
  igual('sin categorías repetidas', fila.punto?.categorias, [
    { slug: 'agua_embotellada', nivel: 'alta' },
  ]);
}

console.log(fallas === 0 ? '\n✓ todo bien\n' : `\n✗ ${fallas} fallas\n`);
process.exit(fallas === 0 ? 0 : 1);
