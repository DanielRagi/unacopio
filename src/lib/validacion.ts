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

/**
 * Deja el teléfono en formato +57XXXXXXXXXX cuando se puede deducir.
 * Se acepta como lo escriba la gente: con espacios, guiones, con o sin +57.
 */
export function normalizarTelefono(entrada: string): string {
  const digitos = entrada.replace(/\D/g, '');
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

export const esquemaRegistro = z
  .object({
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

    telefono: z.string().trim()
      .min(7, 'Escribe un teléfono de contacto')
      .refine((v) => {
        const d = v.replace(/\D/g, '');
        return d.length >= 7 && d.length <= 12;
      }, 'Ese teléfono no parece completo')
      .transform(normalizarTelefono),

    whatsapp: z.coerce.boolean().default(false),
    telefono_publico: z.coerce.boolean().default(false),

    // Obligatorio desde D8: sin WhatsApp saliente, el correo es el único camino
    // de vuelta para mandar el enlace de edición y el recordatorio de 48h.
    correo: z.email('Escribe un correo válido'),

    horario_texto: z.string().trim()
      .min(4, 'Escribe los días y horas de atención')
      .max(200),
    fecha_inicio: fechaOpcional,
    fecha_fin: fechaOpcional,

    recibe_voluntarios: z.coerce.boolean().default(false),
    notas: opcional(500),

    categorias: z
      .array(z.object({ slug: z.string(), nivel: z.enum(NIVELES) }))
      .min(1, 'Marca al menos una cosa que reciban'),
  })
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
  });

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
    whatsapp: formData.get('whatsapp') !== null,
    telefono_publico: formData.get('telefono_publico') !== null,
    correo: texto('correo'),
    horario_texto: texto('horario_texto'),
    fecha_inicio: texto('fecha_inicio'),
    fecha_fin: texto('fecha_fin'),
    recibe_voluntarios: formData.get('recibe_voluntarios') !== null,
    notas: texto('notas'),
    categorias,
  };
}
