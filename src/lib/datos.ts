import { clienteServidor } from './supabase/servidor';
import type {
  Categoria, Departamento, Municipio, PuntoPublico,
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
