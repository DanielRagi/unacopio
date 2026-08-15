import { clienteServidor } from './supabase/servidor';
import type {
  Categoria, Departamento, EstadoPunto, Municipio, NivelCategoria, PuntoPublico,
  TipoOrganizacion, TipoReporte,
} from './tipos';

/**
 * Capa de acceso a datos, solo lectura y solo desde el servidor.
 *
 * Todo sale de `puntos_publicos` y de los catálogos: nunca de la tabla `puntos`,
 * a la que el rol anónimo ni siquiera llega (ver docs/MODELO-DATOS.md).
 */

const LIMITE_LISTADO = 200;

export async function listarDepartamentos(): Promise<Departamento[]> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from('departamentos')
    .select('codigo, nombre')
    .order('nombre');

  if (error) throw new Error(`No se pudieron cargar los departamentos: ${error.message}`);
  return data ?? [];
}

export async function listarMunicipios(departamentoCodigo?: string): Promise<Municipio[]> {
  const supabase = await clienteServidor();
  let consulta = supabase
    .from('municipios')
    .select('codigo, nombre, departamento_codigo')
    .order('nombre');

  if (departamentoCodigo) consulta = consulta.eq('departamento_codigo', departamentoCodigo);

  const { data, error } = await consulta;
  if (error) throw new Error(`No se pudieron cargar los municipios: ${error.message}`);
  return data ?? [];
}

export async function listarCategorias(): Promise<Categoria[]> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from('categorias')
    .select('slug, nombre, grupo, orden')
    .order('orden');

  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`);
  return data ?? [];
}

export interface FiltroPuntos {
  departamento?: string;
  municipio?: string;
}

/**
 * Puntos publicados. Ordenados por verificación más reciente: lo que se confirmó
 * hace poco es lo que menos riesgo tiene de mandar a alguien a un portón cerrado.
 */
export async function listarPuntos(filtro: FiltroPuntos = {}): Promise<PuntoPublico[]> {
  const supabase = await clienteServidor();
  let consulta = supabase
    .from('puntos_publicos')
    .select('*')
    .order('ultima_verificacion', { ascending: false, nullsFirst: false })
    .order('actualizado_en', { ascending: false })
    .limit(LIMITE_LISTADO);

  if (filtro.municipio) consulta = consulta.eq('municipio_codigo', filtro.municipio);
  else if (filtro.departamento) consulta = consulta.eq('departamento_codigo', filtro.departamento);

  const { data, error } = await consulta;
  if (error) throw new Error(`No se pudieron cargar los puntos: ${error.message}`);
  return (data ?? []) as PuntoPublico[];
}

export async function contarPuntos(filtro: FiltroPuntos = {}): Promise<number> {
  const supabase = await clienteServidor();
  let consulta = supabase
    .from('puntos_publicos')
    .select('id', { count: 'exact', head: true });

  if (filtro.municipio) consulta = consulta.eq('municipio_codigo', filtro.municipio);
  else if (filtro.departamento) consulta = consulta.eq('departamento_codigo', filtro.departamento);

  const { count, error } = await consulta;
  if (error) throw new Error(`No se pudieron contar los puntos: ${error.message}`);
  return count ?? 0;
}

/* ------------------------------------------------------------------ moderación
 * De aquí para abajo se consulta la tabla `puntos` directamente, no la vista.
 * Solo funciona con una sesión de moderador: RLS lo exige. El equipo necesita
 * ver lo que el público no ve —correo, teléfono sin consentimiento, reportes—
 * porque es con eso que llama a confirmar antes de publicar.
 */

export interface PuntoModeracion {
  id: string;
  nombre: string;
  tipo_organizacion: TipoOrganizacion;
  direccion: string;
  barrio: string | null;
  referencia: string | null;
  lat: number;
  lng: number;
  responsable_nombre: string;
  telefono: string;
  whatsapp: boolean;
  telefono_publico: boolean;
  correo: string | null;
  horario_texto: string;
  notas: string | null;
  estado: EstadoPunto;
  entidad_oficial: boolean;
  ultima_verificacion: string | null;
  reportes_abiertos: number;
  creado_en: string;
  municipios: { nombre: string } | null;
  departamentos: { nombre: string } | null;
  punto_categoria: { nivel: NivelCategoria; categorias: { nombre: string } | null }[];
}

const CAMPOS_MODERACION = `
  id, nombre, tipo_organizacion, direccion, barrio, referencia, lat, lng,
  responsable_nombre, telefono, whatsapp, telefono_publico, correo,
  horario_texto, notas, estado, entidad_oficial, ultima_verificacion,
  reportes_abiertos, creado_en,
  municipios(nombre), departamentos(nombre),
  punto_categoria(nivel, categorias(nombre))
`;

/** La cola de moderación. Los pendientes van del más viejo al más nuevo. */
export async function listarPuntosModeracion(estado: EstadoPunto): Promise<PuntoModeracion[]> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from('puntos')
    .select(CAMPOS_MODERACION)
    .eq('estado', estado)
    .order('creado_en', { ascending: estado === 'pendiente' })
    .limit(200);

  if (error) throw new Error(`No se pudo cargar la cola: ${error.message}`);
  return (data ?? []) as unknown as PuntoModeracion[];
}

export async function contarPorEstado(): Promise<Record<string, number>> {
  const supabase = await clienteServidor();
  const estados: EstadoPunto[] = ['pendiente', 'publicado', 'cerrado', 'rechazado'];

  const conteos = await Promise.all(
    estados.map(async (estado) => {
      const { count } = await supabase
        .from('puntos')
        .select('id', { count: 'exact', head: true })
        .eq('estado', estado);
      return [estado, count ?? 0] as const;
    }),
  );

  return Object.fromEntries(conteos);
}

export interface Solicitud {
  id: string;
  punto_id: string;
  tipo: TipoReporte;
  comentario: string | null;
  contacto: string | null;
  es_responsable: boolean;
  creado_en: string;
  puntos: {
    nombre: string;
    estado: EstadoPunto;
    telefono: string;
    responsable_nombre: string;
    municipios: { nombre: string } | null;
  } | null;
}

/**
 * La bandeja: todo lo que la gente nos ha dicho sobre un punto y todavía nadie
 * ha atendido.
 *
 * Lo de quien dice ser el responsable va primero. No porque esté verificado
 * —no lo está—, sino porque suele traer el dato que hace falta para arreglar la
 * ficha, mientras que un reporte de tercero casi siempre pide ir a confirmar.
 */
export async function listarSolicitudes(): Promise<Solicitud[]> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from('reportes')
    .select(`
      id, punto_id, tipo, comentario, contacto, es_responsable, creado_en,
      puntos(nombre, estado, telefono, responsable_nombre, municipios(nombre))
    `)
    .eq('resuelto', false)
    .order('es_responsable', { ascending: false })
    .order('creado_en', { ascending: true })
    .limit(200);

  if (error) throw new Error(`No se pudo cargar la bandeja: ${error.message}`);
  return (data ?? []) as unknown as Solicitud[];
}

export async function contarSolicitudes(): Promise<number> {
  const supabase = await clienteServidor();
  const { count } = await supabase
    .from('reportes')
    .select('id', { count: 'exact', head: true })
    .eq('resuelto', false);
  return count ?? 0;
}

/** Devuelve el perfil si quien está en sesión es del equipo. Si no, null. */
export async function obtenerModerador() {
  const supabase = await clienteServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return null;

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('id, nombre, rol')
    .eq('id', sesion.user.id)
    .maybeSingle();

  return { usuario: sesion.user, perfil };
}

export async function obtenerPunto(id: string): Promise<PuntoPublico | null> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from('puntos_publicos')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  // `maybeSingle` no falla cuando no hay fila: devuelve null, que es justo lo
  // que necesita la página para responder 404.
  if (error) throw new Error(`No se pudo cargar el punto: ${error.message}`);
  return (data as PuntoPublico | null) ?? null;
}
