/**
 * Trae los puntos de "Centros de Acopio Colombia" y los deja en el formato del
 * pilotaje.
 *
 *   npm run acopio-colombia
 *
 * emergency-rosy.vercel.app es otro proyecto ciudadano que publica el mismo tipo
 * de directorio, con más datos que nosotros y con notas de verificación serias.
 * Los hechos que publica —dónde queda un punto, qué recibe— no son de nadie, y
 * su sitio es público. Aun así:
 *
 *   · **Se respeta su `robots.txt`**, que permite `/` y prohíbe `/api`. Los
 *     datos salen del HTML prerenderizado de la portada, que es justo lo que
 *     autorizan. No se toca `/api` aunque sea más cómodo.
 *   · **Una sola petición por corrida**, con User-Agent identificado.
 *   · **La atribución viaja con cada punto**: `fuente_nombre` y `fuente_url`
 *     apuntan a la fuente original que ellos citan, y la nota deja dicho que el
 *     dato pasó por ellos. Si alguien pregunta de dónde salió, la respuesta está
 *     completa.
 *
 * Y como todo lo demás (D13), nada de esto se publica solo: sale un CSV que
 * moderación revisa y que termina en la cola de pendientes.
 *
 * Lo correcto además de esto es escribirles y unir esfuerzos, que es lo que
 * dice nuestra propia página `/datos`: una sola lista sirve más que dos que se
 * contradicen.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'datos', 'pilotaje');

const ORIGEN = 'https://emergency-rosy.vercel.app/';
const AGENTE = 'UnAcopio/1.0 (directorio de puntos de acopio; https://unacopio.co; hola@unacopio.co)';

/** Las ciudades del pilotaje. Ellos escriben Bogotá de dos formas. */
const CIUDADES = {
  'Medellín': { codigo: '05001', archivo: 'medellin' },
  'Bogotá D.C.': { codigo: '11001', archivo: 'bogota' },
  'Bogotá': { codigo: '11001', archivo: 'bogota' },
};

/**
 * De su texto libre a nuestras categorías.
 *
 * Ellos guardan frases ("Alimentos no perecederos", "Material para curaciones")
 * y nosotros slugs de un catálogo cerrado. El mapeo es deliberadamente
 * conservador: lo que no encaje claro **no se inventa**, se acumula y termina
 * en las notas del punto para que moderación lo lea. Es mejor una ficha que
 * dice "también reciben cascos de rescate" en las notas que una que mete eso
 * en una categoría que no le corresponde.
 */
const CATEGORIAS = [
  ['agua_embotellada', /agua potable|agua embotellada|^agua$|hidrataci[óo]n/i],
  ['agua_bidones', /bid[óo]n|garrafa/i],
  ['tanques', /tanque/i],
  ['no_perecederos', /no perecedero/i],
  ['enlatados', /enlatado|at[úu]n|sardina/i],
  ['granos', /grano|arroz|fr[íi]jol|lenteja|pasta|legumbre|cereal/i],
  ['panela_azucar', /panela|az[úu]car/i],
  ['aceite', /aceite/i],
  ['formula_infantil', /f[óo]rmula|compota|beb[ée]s?\b/i],
  ['comida_preparada', /comida preparada|listos? para consum|perecedero/i],
  ['jabon', /jab[óo]n|shampoo|champ[úu]/i],
  ['papel_higienico', /papel higi[ée]nico/i],
  ['panales_bebe', /pa[ñn]al/i],
  ['toallas_higienicas', /toallas? higi[ée]nica/i],
  ['cepillo_crema_dental', /cepillo|crema dental|dental/i],
  ['desinfectantes', /desinfectante|detergente|limpieza/i],
  ['botiquin', /primeros auxilios|curacion|gasa|algod[óo]n|vendaje|insumos? m[ée]dico|antis[ée]ptico|jeringa|suero fisiol/i],
  ['medicamentos_sellados', /medicamento/i],
  ['suero_oral', /suero oral|sales de rehidrataci/i],
  ['tapabocas', /tapabocas|mascarilla/i],
  ['guantes', /guantes (?:desechables|quir[úu]rgicos|de l[áa]tex)|^guantes$/i],
  ['colchonetas', /colchoneta|colch[óo]n/i],
  ['cobijas', /cobija|manta|frazada/i],
  ['sabanas', /s[áa]bana|almohada/i],
  ['carpas', /carpa/i],
  ['plasticos_lona', /pl[áa]stico|lona/i],
  ['toldillos', /toldillo|mosquitero/i],
  ['ropa_nueva', /ropa nueva/i],
  ['ropa_usada_buen_estado', /ropa usada|^ropa$/i],
  ['calzado', /calzado|zapato/i],
  ['ropa_bebe', /ropa de beb/i],
  ['ollas_utensilios', /olla|utensilio|menaje/i],
  ['estufas_gas', /estufa|pipeta/i],
  ['velas_linternas', /vela|linterna/i],
  ['pilas', /^pilas|bater[íi]as? (?:aa|secas)/i],
  ['baterias_celular', /power bank|bater[íi]a port/i],
  ['tejas', /teja/i],
  ['herramientas', /herramienta/i],
  ['palas_picas', /pala|pica\b/i],
  ['guantes_trabajo', /guantes de (?:protecci|trabajo|construcci)/i],
  ['botas', /botas/i],
  ['alimento_perro', /alimento para (?:mascota|perro)|concentrado/i],
  ['alimento_gato', /alimento para gato|arena para gato/i],
  ['guacales', /guacal|correa|bozal/i],
  ['voluntarios', /voluntari/i],
];

function aCategorias(frases = []) {
  const slugs = new Set();
  const sinMapear = [];
  for (const frase of frases) {
    const encontrados = CATEGORIAS.filter(([, patron]) => patron.test(frase)).map(([s]) => s);
    if (encontrados.length === 0) sinMapear.push(frase);
    else encontrados.forEach((s) => slugs.add(s));
  }
  return { slugs: [...slugs], sinMapear };
}

/** Su `type` a nuestro `tipo_organizacion`, mirando también el nombre. */
function tipoDe(centro) {
  const texto = `${centro.name} ${centro.organization ?? ''}`.toLowerCase();
  if (/alcald[íi]a|gobernaci[óo]n|distrital/.test(texto)) return 'alcaldia';
  if (/cruz roja/.test(texto)) return 'cruz_roja';
  if (/bomberos/.test(texto)) return 'bomberos';
  if (/defensa civil/.test(texto)) return 'defensa_civil';
  if (/parroquia|iglesia|arquidi[óo]cesis|casa cural/.test(texto)) return 'iglesia';
  if (/universidad|eafit|externado/.test(texto)) return 'universidad';
  if (/fundaci[óo]n|corporaci[óo]n/.test(texto)) return 'fundacion';
  if (/batall[óo]n|ej[ée]rcito|gaula|polic[íi]a/.test(texto)) return 'gobernacion';
  if (/biblioteca/.test(texto)) return 'alcaldia';
  if (centro.type === 'medical') return 'ong';
  if (/terminal|centro comercial|mall|unicentro|mayorista/.test(texto)) return 'empresa';
  return 'particular';
}

const respuesta = await fetch(ORIGEN, { headers: { 'User-Agent': AGENTE } });
if (!respuesta.ok) {
  console.error(`No respondió: HTTP ${respuesta.status}`);
  process.exit(1);
}
const html = await respuesta.text();

// El payload de React viene en trozos `self.__next_f.push([1,"...")]`.
const trozos = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)]
  .map((m) => JSON.parse(m[1]));
const payload = trozos.join('');

/** Recorta cada objeto balanceado que contenga la marca. */
function objetosCon(texto, marca) {
  const encontrados = [];
  let desde = 0;
  for (;;) {
    const golpe = texto.indexOf(marca, desde);
    if (golpe === -1) break;
    desde = golpe + 1;

    let inicio = golpe;
    let nivel = 0;
    for (; inicio >= 0; inicio--) {
      if (texto[inicio] === '}') nivel++;
      else if (texto[inicio] === '{') {
        if (nivel === 0) break;
        nivel--;
      }
    }
    if (inicio < 0) continue;

    let fin = inicio;
    nivel = 0;
    let enCadena = false;
    for (; fin < texto.length; fin++) {
      const c = texto[fin];
      if (enCadena) {
        if (c === '\\') fin++;
        else if (c === '"') enCadena = false;
        continue;
      }
      if (c === '"') enCadena = true;
      else if (c === '{') nivel++;
      else if (c === '}' && --nivel === 0) break;
    }

    try {
      encontrados.push(JSON.parse(texto.slice(inicio, fin + 1)));
    } catch {
      /* trozo cortado por la mitad: se ignora */
    }
  }
  return encontrados;
}

const todos = objetosCon(payload, '"verification_status"').filter((c) => c.name && c.municipality);
const unicos = [...new Map(todos.map((c) => [c.slug ?? c.name, c])).values()];
console.log(`${unicos.length} centros leídos de la portada`);

const porArchivo = {};
let fuera = 0;

for (const centro of unicos) {
  const ciudad = CIUDADES[centro.municipality];
  if (!ciudad) { fuera++; continue; }

  const recibe = aCategorias([...(centro.accepted_items ?? []), ...(centro.urgent_needs ?? [])]);
  const urgente = aCategorias(centro.urgent_needs ?? []);
  const rechaza = aCategorias(centro.rejected_items ?? []);

  const notas = [];
  if (centro.organization && centro.organization !== centro.name) {
    notas.push(`Lo opera ${centro.organization}.`);
  }
  if (centro.verification_status === 'verified' && centro.last_verified_at) {
    notas.push(
      `Acopio Colombia lo dio por verificado el ${centro.last_verified_at.slice(0, 10)} contra el canal propio de la entidad. Igual hay que llamar: acá no se publica nada sin confirmar de primera mano.`,
    );
  } else {
    notas.push('Acopio Colombia lo tiene como REPORTADO, sin verificar contra la entidad. Confirmar antes que nada.');
  }
  if (centro.location_precision !== 'exact') {
    notas.push('PIN APROXIMADO según la fuente. Verificarlo al editar.');
  }
  if (centro.ends_at) notas.push(`La fuente dice que cierra el ${centro.ends_at}.`);
  if (centro.email) notas.push(`Correo: ${centro.email}`);
  if (centro.whatsapp && centro.whatsapp !== centro.phone) notas.push(`WhatsApp: ${centro.whatsapp}`);

  const sinMapear = [...new Set([...recibe.sinMapear, ...rechaza.sinMapear])];
  if (sinMapear.length > 0) {
    notas.push(`No cabe en nuestras categorías, preguntarlo al llamar: ${sinMapear.join('; ')}.`);
  }

  const punto = {
    nombre: centro.name,
    tipo: tipoDe(centro),
    direccion: centro.address ?? centro.name,
    lat: centro.latitude ?? undefined,
    lng: centro.longitude ?? undefined,
    telefono: (centro.phone ?? centro.whatsapp ?? '').replace(/[^\d+]/g, '') || undefined,
    horario: centro.schedule_text || undefined,
    urgente: urgente.slugs,
    recibe: recibe.slugs,
    no_recibe: rechaza.slugs,
    // La fuente que ELLOS citan, no su sitio: es de donde salió el dato.
    fuente_nombre: centro.source_name
      ? `${centro.source_name} (vía Centros de Acopio Colombia)`
      : 'Centros de Acopio Colombia',
    fuente_url: centro.source_url ?? ORIGEN,
    nota: notas.join(' · '),
  };
  if (centro.ends_at) punto.fecha_fin = centro.ends_at;

  (porArchivo[ciudad.archivo] ??= { codigo: ciudad.codigo, puntos: [] }).puntos.push(punto);
}

const NOMBRES = { medellin: 'Medellín', bogota: 'Bogotá D.C.' };

for (const [archivo, { codigo, puntos }] of Object.entries(porArchivo)) {
  const destino = join(SALIDA, `2026-08-${archivo}-acopio-colombia.json`);
  writeFileSync(
    destino,
    `${JSON.stringify(
      {
        _lea_esto_primero: [
          'Extraído de "Centros de Acopio Colombia" (emergency-rosy.vercel.app), otro',
          'proyecto ciudadano independiente que publica el mismo tipo de directorio.',
          '',
          'Se leyó únicamente la portada, que su robots.txt permite; su /api está',
          'prohibida y no se tocó. La atribución de cada punto apunta a la fuente',
          'ORIGINAL que ellos citan, no a su sitio, porque es de donde salió el dato.',
          '',
          'Su estado de verificación NO nos sirve de aval: acá nada se publica sin',
          'que un moderador llame (D13). Lo que sí aporta es que muchos traen',
          'teléfono y coordenada exacta, que es justo lo que nos faltaba.',
          '',
          'Se regenera con `npm run acopio-colombia`.',
        ],
        municipio_codigo: codigo,
        municipio: NOMBRES[archivo],
        recolectado_en: new Date().toISOString().slice(0, 10),
        fuente_principal: {
          nombre: 'Centros de Acopio Colombia',
          url: ORIGEN,
          nota: 'Proyecto ciudadano independiente. Cada punto conserva además la fuente original que ellos citan.',
        },
        recibe: [],
        no_recibe: [],
        puntos,
      },
      null,
      2,
    )}\n`,
  );
  const conTelefono = puntos.filter((p) => p.telefono).length;
  console.log(
    `${NOMBRES[archivo].padEnd(12)} ${String(puntos.length).padStart(3)} puntos · ` +
      `${conTelefono} con teléfono · ${puntos.filter((p) => p.lat).length} con coordenada`,
  );
}

console.log(`${fuera} centros de otras ciudades, fuera del pilotaje`);
console.log('\nRevisa los archivos y corre `npm run pilotaje` para armar el CSV.\n');
