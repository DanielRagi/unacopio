/**
 * Textos de la interfaz, centralizados.
 *
 * La v1 es solo en español y no lleva capa de i18n (ver docs/DECISIONES.md, D7).
 * Tener las cadenas aquí es lo que permite meter i18n después sin tocar los
 * componentes uno por uno.
 */

import type { NivelCategoria, TipoOrganizacion, GrupoCategoria } from './tipos';

export const SITIO = {
  nombre: 'UnAcopio',
  lema: 'Puntos de acopio para la emergencia',
  descripcion:
    'Encuentra el punto de acopio más cercano o registra el tuyo. ' +
    'Información abierta sobre dónde llevar donaciones en Colombia.',
  dominio: 'unacopio.co',
} as const;

export const AVISOS = {
  sinDinero:
    'UnAcopio no recibe dinero ni donaciones. Solo publicamos información de ' +
    'puntos operados por terceros. Desconfía de quien te pida transferencias.',
  informacionDeTerceros:
    'La información la aporta quien registra cada punto. Verifica por teléfono ' +
    'antes de desplazarte.',
  habeasData:
    'Autorizo publicar mi nombre y teléfono en el directorio para que los ' +
    'donantes puedan contactarme (Ley 1581 de 2012).',
} as const;

export const NIVELES: Record<NivelCategoria, { etiqueta: string; ayuda: string }> = {
  alta:      { etiqueta: 'Se necesita urgente', ayuda: 'Es lo que más falta ahora mismo' },
  si:        { etiqueta: 'Sí recibimos',        ayuda: 'Se puede llevar' },
  no_recibe: { etiqueta: 'NO recibimos',        ayuda: 'Por favor no llevar' },
};

export const TIPOS_ORGANIZACION: Record<TipoOrganizacion, string> = {
  alcaldia: 'Alcaldía',
  gobernacion: 'Gobernación',
  bomberos: 'Bomberos',
  defensa_civil: 'Defensa Civil',
  cruz_roja: 'Cruz Roja',
  iglesia: 'Iglesia o parroquia',
  jac: 'Junta de Acción Comunal',
  ong: 'ONG',
  fundacion: 'Fundación',
  empresa: 'Empresa',
  colegio: 'Colegio',
  universidad: 'Universidad',
  conjunto_residencial: 'Conjunto residencial',
  particular: 'Persona natural',
};

export const GRUPOS: Record<GrupoCategoria, string> = {
  agua: 'Agua',
  alimentos: 'Alimentos',
  aseo: 'Aseo e higiene',
  salud: 'Salud',
  albergue: 'Albergue y dormida',
  ropa: 'Ropa',
  hogar: 'Hogar',
  construccion: 'Construcción y herramientas',
  mascotas: 'Mascotas',
  otros: 'Otros',
};

/** "hace 2 horas", "hace 3 días" — para el semáforo de frescura. */
export function haceCuanto(fecha: string | Date | null): string {
  if (!fecha) return 'sin verificar';
  const ms = Date.now() - new Date(fecha).getTime();
  const minutos = Math.floor(ms / 60000);
  if (minutos < 60) return minutos <= 1 ? 'hace un momento' : `hace ${minutos} minutos`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return horas === 1 ? 'hace 1 hora' : `hace ${horas} horas`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}

/** Semáforo de confiabilidad de la información. */
export function frescura(ultimaVerificacion: string | null): 'fresca' | 'tibia' | 'vieja' {
  if (!ultimaVerificacion) return 'vieja';
  const horas = (Date.now() - new Date(ultimaVerificacion).getTime()) / 3_600_000;
  if (horas < 24) return 'fresca';
  if (horas < 72) return 'tibia';
  return 'vieja';
}
