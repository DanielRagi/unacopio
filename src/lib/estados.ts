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
  /**
   * El error devuelve además **lo que la persona había escrito**.
   *
   * Sin eso el formulario se vuelve a renderizar vacío y hay que llenarlo de
   * cero: media hora de trabajo perdida por una tilde en el teléfono. Los
   * campos no controlados no conservan nada solos, así que los valores tienen
   * que dar la vuelta por el servidor y volver como `defaultValue`.
   */
  | {
      estado: 'error';
      errores: Record<string, string[]>;
      mensaje?: string;
      valores: Record<string, string>;
    }
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
  /** Escribiendo el código de seis dígitos, con el error del intento anterior. */
  | { estado: 'codigo'; correo: string; mensaje?: string }
  | { estado: 'error'; mensaje: string };

export const ACCESO_INICIAL: EstadoAcceso = { estado: 'inicial' };
