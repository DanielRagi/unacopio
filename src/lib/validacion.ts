import { z } from 'zod';
import type { NivelCategoria } from './tipos';

/**
 * Validación del formulario público de registro.
 *
 * Corre en el servidor, dentro de la Server Action: lo que valide el navegador
 * es comodidad, no seguridad. La base pone la última línea de defensa
 * (`registrar_punto` fuerza el estado y revisa que la coordenada caiga en
 * Colombia), pero acá es donde se pueden dar mensajes de error en español.
 */

const TIPOS = [
  'alcaldia', 'gobernacion', 'bomberos', 'defensa_civil', 'cruz_roja',
  'iglesia', 'jac', 'ong', 'fundacion', 'empresa', 'colegio', 'universidad',
  'conjunto_residencial', 'particular',
] as const;

const NIVELES = ['alta', 'si', 'no_recibe'] as const;

/** Lo que queda en `telefono` cuando no hay un número que marcar. */
export const SIN_TELEFONO = 'Por confirmar';

/**
 * ¿Ese "teléfono" se puede marcar?
 *
 * La columna `telefono` no siempre trae un número. Hay puntos cuyo único
 * contacto es Instagram, y ahí dice "Por confirmar"; los que entraron por
 * importación pueden decir "por conseguir". Ofrecerles un botón de "Llamar" que
 * abre el marcador con basura es peor que no ofrecer nada: la persona cree que
 * el sitio está roto, y con razón.
 *
 * Siete dígitos es el mínimo real en Colombia (un fijo sin indicativo).
 */
export function esTelefonoMarcable(telefono: string | null | undefined): telefono is string {
  if (!telefono) return false;
  const digitos = telefono.replace(/\D/g, '');
  return digitos.length >= 7 && digitos.length <= 13;
}

/**
 * Deja el usuario de Instagram en su forma canónica: sin arroba, sin URL, en
 * minúsculas.
 *
 * La gente lo escribe de todas las formas —`@acopio`, `instagram.com/acopio`,
 * `https://www.instagram.com/acopio/?hl=es`— y guardar cada variante tal cual
 * significa no poder compararlas ni armar el enlace.
 */
export function normalizarInstagram(entrada: string): string {
  return entrada
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?instagram\.com\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .replace(/^@+/, '')
    .toLowerCase();
}

/**
 * Deja el teléfono en formato +57XXXXXXXXXX cuando se puede deducir.
 *
 * Se acepta como lo escriba la gente: con espacios, guiones, con o sin +57. Y
 * si lo que llegó no es un número —"Por confirmar", "solo Instagram", vacío—
 * se devuelve el marcador tal cual en vez de fabricar un `+57` con basura
 * detrás, que después terminaría en un botón de "Llamar" que no marca nada.
 */
export function normalizarTelefono(entrada: string): string {
  const digitos = entrada.replace(/\D/g, '');
  if (digitos.length < 7 || digitos.length > 13) return SIN_TELEFONO;
  if (digitos.length === 12 && digitos.startsWith('57')) return `+${digitos}`;
  if (digitos.length === 10) return `+57${digitos}`;
  return `+57${digitos}`;
}

const opcional = (maximo: number) =>
  z.string().trim().max(maximo).optional().transform((v) => (v === '' ? undefined : v));

const fechaOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === '' ? undefined : v))
  .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Fecha inválida');

/** Una franja del selector de horario. */
const franja = z
  .object({
    dia: z.number().int().min(0).max(6),
    desde: z.string().regex(/^\d{2}:\d{2}$/),
    hasta: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine((f) => f.hasta > f.desde, 'La hora de cierre debe ser posterior a la de apertura');

const camposComunes = {
    nombre: z.string().trim()
      .min(3, 'Escribe el nombre del punto de acopio')
      .max(120, 'El nombre quedó muy largo'),

    tipo_organizacion: z.enum(TIPOS, { message: 'Elige quién organiza el punto' }),

    departamento_codigo: z.string().regex(/^\d{2}$/, 'Elige el departamento'),
    municipio_codigo: z.string().regex(/^\d{5}$/, 'Elige el municipio'),

    direccion: z.string().trim()
      .min(5, 'Escribe la dirección')
      .max(200, 'La dirección quedó muy larga'),
    barrio: opcional(80),
    referencia: opcional(200),

    // Vienen del mapa. Si la persona no tiene JavaScript no hay pin, y la acción
    // cae al centroide del municipio.
    lat: z.coerce.number().min(-5).max(14).optional(),
    lng: z.coerce.number().min(-82).max(-66).optional(),

    responsable_nombre: z.string().trim()
      .min(3, 'Escribe el nombre de quien responde')
      .max(120),

    /*
     * El teléfono ya no exige ser un número.
     *
     * Hay puntos —colectivos, fundaciones chicas— cuyo único contacto real es
     * una cuenta de Instagram. Antes tenían que inventarse un número para poder
     * registrarse, y un número inventado es peor que ninguno: manda a la gente
     * a marcar a un desconocido y hace que la ronda de verificación pierda el
     * tiempo. Lo que no sea marcable queda como "Por confirmar", y la ficha
     * simplemente no ofrece el botón de llamar.
     *
     * La regla que reemplaza a esta —tiene que haber teléfono o Instagram— está
     * abajo, en las reglas cruzadas, porque mira dos campos a la vez.
     */
    telefono: z.string().trim().max(60).transform(normalizarTelefono),

    /** Sin arroba y en minúsculas. Se publica: es el canal de contacto. */
    instagram: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((v) => {
        const usuario = v ? normalizarInstagram(v) : '';
        return usuario === '' ? undefined : usuario;
      })
      .refine(
        (v) => v === undefined || /^[a-z0-9._]{1,30}$/.test(v),
        'Ese usuario de Instagram no parece válido',
      ),

    whatsapp: z.coerce.boolean().default(false),
    telefono_publico: z.coerce.boolean().default(false),

    // Opcional: la plataforma no manda correos (D8), así que no hay nada que
    // entregar por ahí. Se pide igual porque a moderación le sirve para
    // escribirle al responsable a mano cuando el teléfono no contesta.
    correo: z
      .union([z.email('Escribe un correo válido'), z.literal('')])
      .optional()
      .transform((v) => (v === '' ? undefined : v)),

    fecha_inicio: fechaOpcional,
    fecha_fin: fechaOpcional,

    recibe_voluntarios: z.coerce.boolean().default(false),
    notas: opcional(500),

    categorias: z
      .array(z.object({ slug: z.string(), nivel: z.enum(NIVELES) }))
      .min(1, 'Marca al menos una cosa que reciban'),
};

/** Lo mínimo que tiene que traer un esquema para que las reglas de abajo apliquen. */
interface CamposCruzados {
  departamento_codigo: string;
  municipio_codigo: string;
  telefono: string;
  instagram?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  categorias: { slug: string; nivel: NivelCategoria }[];
}

/**
 * Las reglas que cruzan varios campos. Iguales para el público y para moderación.
 *
 * El genérico va sobre `z.ZodType<CamposCruzados>` y no sobre `ZodObject`: así
 * `refine` conserva el tipo de salida del esquema que entra, y `z.infer` del
 * resultado sigue trayendo todos los campos en vez de `unknown`.
 */
const conReglasCruzadas = <T extends z.ZodType<CamposCruzados>>(esquema: T) =>
  esquema
    .refine((d) => d.municipio_codigo.startsWith(d.departamento_codigo), {
      message: 'El municipio no corresponde al departamento',
      path: ['municipio_codigo'],
    })
    .refine((d) => !d.fecha_fin || !d.fecha_inicio || d.fecha_fin >= d.fecha_inicio, {
      message: 'La fecha de cierre no puede ser anterior a la de inicio',
      path: ['fecha_fin'],
    })
    .refine((d) => d.categorias.some((c) => c.nivel !== 'no_recibe'), {
      message: 'Marca al menos una cosa que sí reciban',
      path: ['categorias'],
    })
    /*
     * Alguna forma de contactarlos, la que sea.
     *
     * Reemplaza a la vieja validación de teléfono. Un punto sin número marcable
     * y sin Instagram no se puede verificar por teléfono ni preguntarle nada, y
     * publicar una dirección que nadie puede confirmar es exactamente lo que
     * hace que la gente pierda el viaje.
     */
    .refine((d) => esTelefonoMarcable(d.telefono) || d.instagram !== undefined, {
      message: 'Hace falta un teléfono o un Instagram para poder contactarlos',
      path: ['telefono'],
    });

/**
 * El formulario público. Acá el horario **sí** es obligatorio: quien registra su
 * propio punto sabe a qué hora abre, y es el dato que evita el viaje perdido.
 */
export const esquemaRegistro = conReglasCruzadas(
  z.object({
    ...camposComunes,
    // El horario llega estructurado desde el selector; el texto legible se
    // genera después, en el servidor, para que no puedan contradecirse.
    horarios: z.array(franja).min(1, 'Marca al menos un día de atención').max(21),
  }),
);

/**
 * El formulario de moderación. Igual, salvo que el horario puede quedar vacío.
 *
 * Quien modera muchas veces no lo sabe: está corrigiendo un teléfono de un punto
 * que se cargó desde una lista, o acaba de colgar con alguien que dijo "eso
 * depende del día". Exigirlo bloqueaba el resto de la edición —no se podía
 * arreglar ni una dirección sin inventarse un horario—, y inventarlo es peor que
 * no tenerlo: el sello de "Abierto ahora" saldría mintiendo.
 *
 * Sin franjas no hay sello, que es justo lo que dice D12. La base ya permite
 * `horarios` nulo; lo único que sobraba era esta validación.
 */
export const esquemaModeracion = conReglasCruzadas(
  z.object({
    ...camposComunes,
    horarios: z.array(franja).max(21).default([]),
  }),
);

export type DatosRegistro = z.infer<typeof esquemaRegistro>;

/**
 * Saca del FormData la forma que espera el esquema. Las categorías llegan como
 * campos sueltos `cat_<slug>`, que es lo que produce un grupo de radios; acá se
 * vuelven un arreglo.
 */
export function leerFormulario(formData: FormData): Record<string, unknown> {
  const texto = (campo: string) => {
    const v = formData.get(campo);
    return typeof v === 'string' ? v : '';
  };

  // El horario viaja como JSON en un campo oculto. Si llega roto se deja pasar
  // vacío y el esquema da el error en español, en vez de reventar acá.
  const leerJson = (crudo: string): unknown => {
    if (!crudo) return [];
    try {
      return JSON.parse(crudo);
    } catch {
      return [];
    }
  };

  const categorias: { slug: string; nivel: NivelCategoria }[] = [];
  for (const [campo, valor] of formData.entries()) {
    if (!campo.startsWith('cat_') || typeof valor !== 'string' || valor === '') continue;
    if ((NIVELES as readonly string[]).includes(valor)) {
      categorias.push({ slug: campo.slice(4), nivel: valor as NivelCategoria });
    }
  }

  return {
    nombre: texto('nombre'),
    tipo_organizacion: texto('tipo_organizacion'),
    departamento_codigo: texto('departamento_codigo'),
    municipio_codigo: texto('municipio_codigo'),
    direccion: texto('direccion'),
    barrio: texto('barrio'),
    referencia: texto('referencia'),
    lat: texto('lat') === '' ? undefined : texto('lat'),
    lng: texto('lng') === '' ? undefined : texto('lng'),
    responsable_nombre: texto('responsable_nombre'),
    telefono: texto('telefono'),
    instagram: texto('instagram'),
    whatsapp: formData.get('whatsapp') !== null,
    telefono_publico: formData.get('telefono_publico') !== null,
    correo: texto('correo'),
    horarios: leerJson(texto('horarios')),
    fecha_inicio: texto('fecha_inicio'),
    fecha_fin: texto('fecha_fin'),
    recibe_voluntarios: formData.get('recibe_voluntarios') !== null,
    notas: texto('notas'),
    categorias,
  };
}
