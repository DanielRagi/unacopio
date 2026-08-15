/**
 * La API abierta: `/api/puntos.json` y `/api/puntos.csv`.
 *
 * Existe por una razón práctica, no por completismo. En toda emergencia aparecen
 * cinco listas distintas de puntos de acopio —la de la alcaldía, la del
 * periódico, tres cadenas de WhatsApp— y ninguna coincide con las otras. Si
 * cualquiera puede tomar estos datos y montar su propia vista, hay una sola
 * lista que mantener en vez de cinco.
 *
 * Por eso: sin llave, con CORS abierto y con licencia explícita.
 */

import { clientePublico } from './supabase/publico';
import { SITIO } from './textos';
import type { PuntoPublico } from './tipos';

export const LICENCIA = {
  nombre: 'CC BY 4.0',
  url: 'https://creativecommons.org/licenses/by/4.0/deed.es',
  atribucion: `${SITIO.nombre} — ${SITIO.dominio}`,
} as const;

/** Cuánto puede quedarse un intermediario con la copia. */
export const SEGUNDOS_CACHE = 300;

export interface ConsultaApi {
  departamento?: string;
  municipio?: string;
  categoria?: string;
  limite: number;
}

const LIMITE_MAXIMO = 500;

export function leerConsulta(url: URL): ConsultaApi {
  const texto = (campo: string) => {
    const v = url.searchParams.get(campo)?.trim();
    return v ? v : undefined;
  };

  const limite = Number(url.searchParams.get('limite'));

  return {
    departamento: texto('dep') ?? texto('departamento'),
    municipio: texto('mun') ?? texto('municipio'),
    categoria: texto('cat') ?? texto('categoria'),
    limite: Number.isFinite(limite) && limite > 0 ? Math.min(limite, LIMITE_MAXIMO) : LIMITE_MAXIMO,
  };
}

export async function consultarPuntos(consulta: ConsultaApi): Promise<PuntoPublico[]> {
  const supabase = clientePublico();

  const { data, error } = await supabase.rpc('buscar_puntos', {
    p_departamento: consulta.departamento ?? null,
    p_municipio: consulta.municipio ?? null,
    p_categoria: consulta.categoria ?? null,
    p_lat: null,
    p_lng: null,
    p_radio_m: 20000,
    p_limite: consulta.limite,
  });

  if (error) throw new Error(error.message);
  return ((data ?? []) as { punto: PuntoPublico }[]).map((f) => f.punto);
}

const base = process.env.NEXT_PUBLIC_SITIO_URL ?? `https://${SITIO.dominio}`;

/** Los slugs de las categorías de un nivel, que es lo que sirve para filtrar. */
const slugsPorNivel = (punto: PuntoPublico, nivel: string) =>
  punto.categorias.filter((c) => c.nivel === nivel).map((c) => c.slug);

export function puntoParaApi(punto: PuntoPublico) {
  return {
    ...punto,
    url: `${base}/punto/${punto.id}`,
    // Redundante con `categorias`, pero le ahorra a quien consume tener que
    // recorrer el arreglo para lo único que casi siempre quiere saber.
    necesita_urgente: slugsPorNivel(punto, 'alta'),
    no_recibe: slugsPorNivel(punto, 'no_recibe'),
  };
}

const COLUMNAS_CSV = [
  'id', 'nombre', 'tipo_organizacion', 'estado', 'entidad_oficial',
  'departamento_codigo', 'departamento', 'municipio_codigo', 'municipio',
  'direccion', 'barrio', 'referencia', 'lat', 'lng',
  'responsable_nombre', 'telefono', 'whatsapp',
  'horario_texto', 'fecha_inicio', 'fecha_fin',
  'recibe_voluntarios', 'necesita_urgente', 'no_recibe', 'notas',
  'ultima_verificacion', 'actualizado_en', 'url',
] as const;

function celda(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (Array.isArray(valor)) return valor.join(';');
  if (typeof valor === 'boolean') return valor ? 'si' : 'no';
  const texto = String(valor);
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * CSV con BOM y saltos CRLF: sin eso, Excel en Windows abre el archivo con las
 * tildes rotas, y quien lo va a usar en una alcaldía lo abre en Excel.
 */
export function aCsv(puntos: PuntoPublico[]): string {
  const filas = puntos.map((p) => {
    const plano = puntoParaApi(p) as Record<string, unknown>;
    return COLUMNAS_CSV.map((columna) => celda(plano[columna])).join(',');
  });

  return `﻿${[COLUMNAS_CSV.join(','), ...filas].join('\r\n')}\r\n`;
}

/** Mismas cabeceras para JSON y CSV: abierto a cualquiera y cacheable. */
export function cabeceras(tipo: string, nombreArchivo?: string): Record<string, string> {
  return {
    'content-type': tipo,
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'cache-control': `public, max-age=60, s-maxage=${SEGUNDOS_CACHE}, stale-while-revalidate=600`,
    'x-license': LICENCIA.nombre,
    ...(nombreArchivo ? { 'content-disposition': `inline; filename="${nombreArchivo}"` } : {}),
  };
}
