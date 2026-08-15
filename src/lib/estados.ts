/**
 * Estados de los formularios que pasan por Server Actions.
 *
 * Viven aparte porque un archivo con "use server" solo puede exportar funciones
 * asíncronas: si el valor inicial se declara junto a la acción, el build falla
 * con «a "use server" file can only export async functions».
 */

import type { FilaRevisada } from './importacion';

export type EstadoRegistro =
  | { estado: 'inicial' }
  | { estado: 'error'; errores: Record<string, string[]>; mensaje?: string }
  | { estado: 'listo'; id: string };

export const ESTADO_INICIAL: EstadoRegistro = { estado: 'inicial' };

export type EstadoEdicion =
  | { estado: 'inicial' }
  | { estado: 'error'; errores: Record<string, string[]>; mensaje?: string }
  | { estado: 'guardado' };

export const EDICION_INICIAL: EstadoEdicion = { estado: 'inicial' };

export type EstadoSolicitud =
  | { estado: 'inicial' }
  | { estado: 'error'; mensaje: string }
  | { estado: 'enviada' };

export const SOLICITUD_INICIAL: EstadoSolicitud = { estado: 'inicial' };

export type EstadoImportacion =
  | { estado: 'inicial' }
  /** Revisado pero sin cargar nada: el CSV vuelve al cliente para confirmarlo. */
  | { estado: 'revisado'; csv: string; filas: FilaRevisada[] }
  | { estado: 'cargado'; creados: number; fallidos: { numero: number; nombre: string; mensaje: string }[] }
  | { estado: 'error'; mensaje: string };

export const IMPORTACION_INICIAL: EstadoImportacion = { estado: 'inicial' };

export type EstadoAcceso =
  | { estado: 'inicial' }
  | { estado: 'enviado'; correo: string }
  | { estado: 'error'; mensaje: string };

export const ACCESO_INICIAL: EstadoAcceso = { estado: 'inicial' };
