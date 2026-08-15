import { leerHorarios, type Franja } from './horarios';
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
  categoria?: string;
  lat?: number;
  lng?: number;
  radioM?: number;
  limite?: number;
}

export interface ResultadoPunto {
  punto: PuntoPublico;
  /** Distancia en metros. Solo viene cuando la persona compartió su ubicación. */
  metros: number | null;
}

/**
 * Todo el listado pasa por aquí, con o sin ubicación.
 *
 * Es una sola RPC (`buscar_puntos`) y no una consulta armada acá por dos
 * razones: el filtro por categoría vive dentro de un `jsonb` que PostgREST no
 * sabe recorrer, y tener una sola puerta evita que el listado y el mapa
 * muestren cosas distintas para el mismo filtro.
 */
export async function buscarPuntos(filtro: FiltroPuntos = {}): Promise<ResultadoPunto[]> {
  const supabase = await clienteServidor();

  const { data, error } = await supabase.rpc('buscar_puntos', {
    p_departamento: filtro.departamento ?? null,
    p_municipio: filtro.municipio ?? null,
    p_categoria: filtro.categoria ?? null,
    p_lat: filtro.lat ?? null,
    p_lng: filtro.lng ?? null,
    p_radio_m: filtro.radioM ?? 20000,
    p_limite: filtro.limite ?? LIMITE_LISTADO,
  });

  if (error) throw new Error(`No se pudieron cargar los puntos: ${error.message}`);
  return (data ?? []) as ResultadoPunto[];
}

/** El centroide DANE de un municipio: sirve para centrar el mapa sin GPS. */
export async function centroideMunicipio(
  codigo: string,
): Promise<{ lat: number; lng: number } | null> {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from('municipios')
    .select('lat, lng')
    .eq('codigo', codigo)
    .maybeSingle();

  return data?.lat != null && data?.lng != null ? { lat: data.lat, lng: data.lng } : null;
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
  const estados: EstadoPunto[] = ['pendiente', 'publicado', 'lleno', 'cerrado', 'rechazado'];

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

/* ------------------------------------------------------- ronda de llamadas */

/** Horas tras las cuales un punto vuelve a la cola de llamadas. */
export const HORAS_FRESCURA = 48;

/** Minutos que un punto queda reservado tras un intento, para no llamar doble. */
const MINUTOS_RESERVA = 30;

export interface PuntoPorLlamar {
  id: string;
  nombre: string;
  estado: EstadoPunto;
  telefono: string;
  whatsapp: boolean;
  responsable_nombre: string;
  correo: string | null;
  ultima_verificacion: string | null;
  ultimo_intento_llamada: string | null;
  intentos_fallidos: number;
  municipios: { nombre: string } | null;
  departamentos: { nombre: string } | null;
}

/**
 * A quién hay que llamar ahora.
 *
 * Lo que lleva más tiempo sin confirmarse va primero, y lo que nunca se ha
 * confirmado va antes que todo. Los puntos que alguien acaba de intentar quedan
 * fuera un rato: con varios voluntarios llamando a la vez, lo normal sería que
 * dos marquen el mismo número con cinco minutos de diferencia.
 */
export async function listarPorLlamar(): Promise<PuntoPorLlamar[]> {
  const supabase = await clienteServidor();

  const limite = new Date(Date.now() - HORAS_FRESCURA * 3_600_000).toISOString();
  const reserva = new Date(Date.now() - MINUTOS_RESERVA * 60_000).toISOString();

  const { data, error } = await supabase
    .from('puntos')
    .select(`
      id, nombre, estado, telefono, whatsapp, responsable_nombre, correo,
      ultima_verificacion, ultimo_intento_llamada, intentos_fallidos,
      municipios(nombre), departamentos(nombre)
    `)
    .in('estado', ['publicado', 'lleno'])
    .or(`ultima_verificacion.is.null,ultima_verificacion.lt.${limite}`)
    .or(`ultimo_intento_llamada.is.null,ultimo_intento_llamada.lt.${reserva}`)
    .order('ultima_verificacion', { ascending: true, nullsFirst: true })
    .limit(100);

  if (error) throw new Error(`No se pudo cargar la ronda de llamadas: ${error.message}`);
  return (data ?? []) as unknown as PuntoPorLlamar[];
}

export async function contarPorLlamar(): Promise<number> {
  return (await listarPorLlamar()).length;
}

export interface Duplicado {
  id: string;
  nombre: string;
  estado: EstadoPunto;
  metros: number;
}

/** Puntos parecidos y cerca. Solo responde con sesión de moderador. */
export async function duplicadosDe(puntoId: string): Promise<Duplicado[]> {
  const supabase = await clienteServidor();
  const { data } = await supabase.rpc('posibles_duplicados', { p_punto_id: puntoId });
  return (data ?? []) as Duplicado[];
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

/** El punto con todo lo editable, incluidas las franjas de horario ya validadas. */
export async function obtenerPuntoParaEditar(id: string) {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from('puntos')
    .select(`
      id, nombre, tipo_organizacion, departamento_codigo, municipio_codigo,
      direccion, barrio, referencia, responsable_nombre, telefono, whatsapp,
      telefono_publico, correo, horarios, fecha_inicio, fecha_fin,
      recibe_voluntarios, notas,
      punto_categoria(categoria_slug, nivel)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`No se pudo cargar el punto: ${error.message}`);
  if (!data) return null;

  return {
    ...data,
    horarios: leerHorarios(data.horarios) ?? [],
  } as Omit<typeof data, 'horarios'> & {
    horarios: Franja[];
    punto_categoria: { categoria_slug: string; nivel: NivelCategoria }[];
  };
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
