/** Tipos que reflejan el esquema de supabase/migrations. Mantener en sincronía. */

export type TipoOrganizacion =
  | 'alcaldia' | 'gobernacion' | 'bomberos' | 'defensa_civil' | 'cruz_roja'
  | 'iglesia' | 'jac' | 'ong' | 'fundacion' | 'empresa' | 'colegio'
  | 'universidad' | 'conjunto_residencial' | 'particular';

export type EstadoPunto = 'pendiente' | 'publicado' | 'rechazado' | 'cerrado' | 'lleno';

/** alta = lo necesitan urgente · si = lo reciben · no_recibe = NO llevar */
export type NivelCategoria = 'alta' | 'si' | 'no_recibe';

export type GrupoCategoria =
  | 'agua' | 'alimentos' | 'aseo' | 'salud' | 'albergue'
  | 'ropa' | 'hogar' | 'construccion' | 'mascotas' | 'otros';

export type TipoReporte = 'cerrado' | 'info_incorrecta' | 'duplicado' | 'no_existe' | 'spam';

export interface Departamento {
  codigo: string;
  nombre: string;
}

export interface Municipio {
  codigo: string;
  nombre: string;
  departamento_codigo: string;
}

export interface Categoria {
  slug: string;
  nombre: string;
  grupo: GrupoCategoria;
  orden: number;
}

export interface CategoriaDePunto {
  slug: string;
  nombre: string;
  grupo: GrupoCategoria;
  nivel: NivelCategoria;
}

/** Lo que devuelve la vista `puntos_publicos`. Nunca trae correo ni token. */
export interface PuntoPublico {
  id: string;
  nombre: string;
  tipo_organizacion: TipoOrganizacion;
  departamento_codigo: string;
  departamento: string;
  municipio_codigo: string;
  municipio: string;
  direccion: string;
  barrio: string | null;
  referencia: string | null;
  lat: number;
  lng: number;
  responsable_nombre: string;
  /** null si la persona no autorizó publicarlo (Habeas Data) */
  telefono: string | null;
  whatsapp: boolean;
  horario_texto: string;
  horarios: unknown | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  recibe_voluntarios: boolean;
  notas: string | null;
  entidad_oficial: boolean;
  ultima_verificacion: string | null;
  actualizado_en: string;
  categorias: CategoriaDePunto[];
}

export interface PuntoCercano {
  punto: PuntoPublico;
  metros: number;
}
