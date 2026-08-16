/**
 * Carga masiva desde CSV.
 *
 * Las alcaldías y los medios casi siempre ya tienen su lista: un Excel, una nota
 * con veinte puntos, un PDF. Volver a digitarla punto por punto en el formulario
 * público son horas que en una emergencia no hay. Esto la recibe entera.
 *
 * Dos cosas que este módulo NO hace, a propósito:
 *
 *   · publicar. Todo entra como `pendiente` y sale a la calle cuando alguien
 *     llame a confirmar, igual que un registro del formulario (ver D13).
 *   · publicar teléfonos. Copiar un número de una publicación no es el
 *     consentimiento que pide la Ley 1581 de 2012. El teléfono queda visible
 *     solo para moderación, que es quien va a llamar y quien puede pedirlo.
 */

import type { NivelCategoria, TipoOrganizacion } from './tipos';

export interface FilaCruda {
  numero: number;
  valores: Record<string, string>;
}

/** Quita tildes y baja a minúsculas: para comparar nombres escritos a la ligera. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Parser de CSV con lo mínimo que hace falta: comillas, comillas escapadas,
 * saltos de línea dentro de una celda y CRLF.
 *
 * El separador se detecta solo. No es un lujo: Excel en español exporta con
 * punto y coma, y quien nos mande una lista la va a exportar desde Excel.
 */
export function parsearCsv(entrada: string): { columnas: string[]; filas: FilaCruda[] } {
  const texto = entrada.replace(/^﻿/, '').trim();
  if (!texto) return { columnas: [], filas: [] };

  const primeraLinea = texto.split(/\r?\n/)[0];
  const separador = contar(primeraLinea, ';') > contar(primeraLinea, ',') ? ';' : ',';

  const registros: string[][] = [];
  let campo = '';
  let registro: string[] = [];
  let enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else enComillas = false;
      } else campo += c;
      continue;
    }

    if (c === '"') { enComillas = true; continue; }
    if (c === separador) { registro.push(campo); campo = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { registro.push(campo); registros.push(registro); registro = []; campo = ''; continue; }
    campo += c;
  }
  registro.push(campo);
  registros.push(registro);

  const [encabezado, ...cuerpo] = registros;
  const columnas = encabezado.map((c) => normalizar(c).replace(/ /g, '_'));

  const filas = cuerpo
    .map((celdas, indice) => ({
      // +2: la primera línea es el encabezado y las personas cuentan desde 1.
      numero: indice + 2,
      valores: Object.fromEntries(columnas.map((col, i) => [col, (celdas[i] ?? '').trim()])),
    }))
    .filter((f) => Object.values(f.valores).some((v) => v !== ''));

  return { columnas, filas };
}

const contar = (texto: string, caracter: string) =>
  texto.split(caracter).length - 1;

export interface MunicipioCatalogo {
  codigo: string;
  nombre: string;
  departamento_codigo: string;
  lat: number | null;
  lng: number | null;
}

export interface CatalogosImportacion {
  municipios: MunicipioCatalogo[];
  categorias: Set<string>;
  /**
   * Slug → etiqueta de los tipos de organización, tal como los ve la gente
   * ("alcaldia" → "Alcaldía"). Llega por parámetro y no importado de
   * `textos.ts` para que este módulo no tenga dependencias en tiempo de
   * ejecución: así lo puede cargar `node` directamente en las pruebas.
   */
  etiquetasDeTipo: Record<string, string>;
}

export interface PuntoImportado {
  nombre: string;
  tipo_organizacion: TipoOrganizacion;
  departamento_codigo: string;
  municipio_codigo: string;
  direccion: string;
  barrio?: string;
  referencia?: string;
  lat: number;
  lng: number;
  responsable_nombre: string;
  telefono: string;
  instagram?: string;
  horario_texto: string;
  notas?: string;
  fuente_nombre?: string;
  fuente_url?: string;
  categorias: { slug: string; nivel: NivelCategoria }[];
}

export interface FilaRevisada {
  numero: number;
  nombre: string;
  municipio: string;
  punto?: PuntoImportado;
  errores: string[];
  advertencias: string[];
}

/** Los encabezados que entiende. Los alias son los que de verdad llegan escritos. */
const ALIAS: Record<string, string[]> = {
  nombre: ['nombre', 'punto', 'punto_de_acopio', 'lugar'],
  tipo_organizacion: ['tipo_organizacion', 'tipo', 'organizacion'],
  municipio: ['municipio', 'municipio_nombre', 'ciudad'],
  municipio_codigo: ['municipio_codigo', 'codigo_dane', 'dane'],
  direccion: ['direccion', 'dir'],
  barrio: ['barrio'],
  referencia: ['referencia', 'punto_de_referencia'],
  lat: ['lat', 'latitud'],
  lng: ['lng', 'lon', 'long', 'longitud'],
  responsable_nombre: ['responsable_nombre', 'responsable', 'contacto'],
  telefono: ['telefono', 'celular', 'tel'],
  instagram: ['instagram', 'ig', 'insta', 'red_social'],
  horario_texto: ['horario_texto', 'horario', 'horarios'],
  necesita_urgente: ['necesita_urgente', 'urgente', 'prioridad'],
  recibe: ['recibe', 'categorias', 'reciben'],
  no_recibe: ['no_recibe', 'no_reciben', 'no_llevar'],
  notas: ['notas', 'observaciones'],
  fuente_nombre: ['fuente_nombre', 'fuente'],
  fuente_url: ['fuente_url', 'url', 'enlace'],
};

const campo = (valores: Record<string, string>, clave: string): string => {
  for (const alias of ALIAS[clave] ?? [clave]) {
    const v = valores[alias];
    if (v) return v;
  }
  return '';
};

/** Los tipos aceptan el slug o la etiqueta que ve la gente ("Alcaldía"). */
const tiposPorTexto = (etiquetas: Record<string, string>) =>
  new Map<string, TipoOrganizacion>([
    ...Object.keys(etiquetas).map((slug) => [normalizar(slug), slug as TipoOrganizacion] as const),
    ...Object.entries(etiquetas).map(
      ([slug, etiqueta]) => [normalizar(etiqueta), slug as TipoOrganizacion] as const,
    ),
  ]);

const numero = (texto: string): number | undefined => {
  if (!texto) return undefined;
  // Coma decimal: "6,25" es como lo escribe Excel en español.
  const n = Number(texto.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

const listaDeSlugs = (texto: string): string[] =>
  texto.split(/[;,|]/).map((s) => s.trim().toLowerCase()).filter(Boolean);

/**
 * Revisa el CSV entero contra los catálogos y dice, fila por fila, qué se puede
 * cargar y qué no.
 *
 * Nunca descarta en silencio: una fila mala se reporta con su número de línea,
 * porque quien mandó el archivo va a querer arreglarlo en el archivo.
 */
export function revisarFilas(
  filas: FilaCruda[],
  catalogos: CatalogosImportacion,
): FilaRevisada[] {
  const tipos = tiposPorTexto(catalogos.etiquetasDeTipo);
  const porCodigo = new Map(catalogos.municipios.map((m) => [m.codigo, m]));
  const porNombre = new Map<string, MunicipioCatalogo[]>();
  for (const m of catalogos.municipios) {
    const clave = normalizar(m.nombre);
    porNombre.set(clave, [...(porNombre.get(clave) ?? []), m]);
  }

  return filas.map((fila) => {
    const v = fila.valores;
    const errores: string[] = [];
    const advertencias: string[] = [];

    const nombre = campo(v, 'nombre');
    const direccion = campo(v, 'direccion');
    const textoMunicipio = campo(v, 'municipio');
    const codigoMunicipio = campo(v, 'municipio_codigo').replace(/\D/g, '');

    if (!nombre) errores.push('Falta el nombre del punto');
    if (!direccion) errores.push('Falta la dirección');

    // Municipio: primero el código DANE, y si no, el nombre.
    let municipio: MunicipioCatalogo | undefined;
    if (codigoMunicipio) {
      municipio = porCodigo.get(codigoMunicipio.padStart(5, '0'));
      if (!municipio) errores.push(`El código DANE "${codigoMunicipio}" no existe`);
    } else if (textoMunicipio) {
      const candidatos = porNombre.get(normalizar(textoMunicipio)) ?? [];
      if (candidatos.length === 1) municipio = candidatos[0];
      else if (candidatos.length === 0) errores.push(`No conozco el municipio "${textoMunicipio}"`);
      else errores.push(
        `"${textoMunicipio}" existe en ${candidatos.length} departamentos: usa el código DANE`,
      );
    } else {
      errores.push('Falta el municipio');
    }

    const tipoTexto = campo(v, 'tipo_organizacion');
    let tipo = tipos.get(normalizar(tipoTexto));
    if (!tipo) {
      // No vale la pena botar una fila entera por esto: moderación lo corrige en
      // dos clics, y el dato que importa —dónde queda y qué reciben— ya llegó.
      tipo = 'particular';
      advertencias.push(
        tipoTexto ? `No reconocí el tipo "${tipoTexto}"; queda como particular` : 'Sin tipo; queda como particular',
      );
    }

    let lat = numero(campo(v, 'lat'));
    let lng = numero(campo(v, 'lng'));
    if ((lat === undefined || lng === undefined) && municipio) {
      if (municipio.lat == null || municipio.lng == null) {
        errores.push('Sin coordenadas y el municipio no tiene centroide');
      } else {
        lat = municipio.lat;
        lng = municipio.lng;
        advertencias.push('Sin coordenadas: queda en el centro del municipio');
      }
    }
    if (lat !== undefined && lng !== undefined) {
      if (lat < -5 || lat > 14 || lng < -82 || lng > -66) {
        errores.push(`Las coordenadas (${lat}, ${lng}) caen fuera de Colombia`);
      }
    }

    const categorias: { slug: string; nivel: NivelCategoria }[] = [];
    const desconocidas: string[] = [];
    const agregar = (texto: string, nivel: NivelCategoria) => {
      for (const slug of listaDeSlugs(texto)) {
        if (!catalogos.categorias.has(slug)) { desconocidas.push(slug); continue; }
        if (!categorias.some((c) => c.slug === slug)) categorias.push({ slug, nivel });
      }
    };
    agregar(campo(v, 'necesita_urgente'), 'alta');
    agregar(campo(v, 'recibe'), 'si');
    agregar(campo(v, 'no_recibe'), 'no_recibe');

    if (desconocidas.length > 0) {
      advertencias.push(`Categorías que no existen y se ignoran: ${desconocidas.join(', ')}`);
    }
    if (categorias.length === 0) {
      advertencias.push('Sin categorías: hay que preguntarlas al llamar');
    }

    const telefono = campo(v, 'telefono');
    // Sin arroba y sin URL, igual que en el resto de la aplicación.
    const instagram = campo(v, 'instagram')
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^(www\.)?instagram\.com\//i, '')
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '')
      .replace(/^@+/, '')
      .toLowerCase();

    if (!telefono && !instagram) {
      advertencias.push('Sin teléfono ni Instagram: no se va a poder verificar');
    } else if (!telefono) {
      advertencias.push('Sin teléfono: hay que escribirles por Instagram');
    }

    const punto: PuntoImportado | undefined =
      errores.length > 0 || !municipio || lat === undefined || lng === undefined
        ? undefined
        : {
            nombre,
            tipo_organizacion: tipo,
            departamento_codigo: municipio.departamento_codigo,
            municipio_codigo: municipio.codigo,
            direccion,
            barrio: campo(v, 'barrio') || undefined,
            referencia: campo(v, 'referencia') || undefined,
            lat,
            lng,
            responsable_nombre: campo(v, 'responsable_nombre'),
            telefono,
            instagram: instagram || undefined,
            horario_texto: campo(v, 'horario_texto'),
            notas: campo(v, 'notas') || undefined,
            fuente_nombre: campo(v, 'fuente_nombre') || undefined,
            fuente_url: campo(v, 'fuente_url') || undefined,
            categorias,
          };

    return {
      numero: fila.numero,
      nombre: nombre || '(sin nombre)',
      municipio: municipio?.nombre ?? textoMunicipio ?? '',
      punto,
      errores,
      advertencias,
    };
  });
}

/** La plantilla que se le manda a quien va a preparar la lista. */
export const PLANTILLA_CSV = [
  'nombre,tipo_organizacion,municipio_codigo,municipio,direccion,barrio,lat,lng,responsable_nombre,telefono,instagram,horario_texto,necesita_urgente,recibe,no_recibe,notas,fuente_nombre,fuente_url',
  'Coliseo Municipal,alcaldia,05001,Medellín,Carrera 74 # 48-10,Estadio,6.2568,-75.5906,María Gómez,3001112233,@acopiomedellin,Lunes a sábado de 8am a 6pm,agua_embotellada;panales,alimentos_no_perecederos,ropa_usada_buen_estado,Reciben hasta el viernes,Alcaldía de Medellín,https://www.medellin.gov.co/',
].join('\r\n');
