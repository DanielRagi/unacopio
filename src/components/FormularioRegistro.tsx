'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { SelectorCategorias } from './SelectorCategorias';
import { SelectorHorario } from './SelectorHorario';
import { registrarPunto } from '@/app/registrar/acciones';
import { ESTADO_INICIAL } from '@/lib/estados';
import type { Franja } from '@/lib/horarios';
import { clienteNavegador } from '@/lib/supabase/cliente';
import { AVISOS, TIPOS_ORGANIZACION } from '@/lib/textos';
import type { Categoria, Departamento, Municipio, TipoOrganizacion } from '@/lib/tipos';

// Leaflet toca el `window` al importarse, así que no puede renderizarse en el
// servidor. Se carga aparte y el formulario sirve igual mientras llega.
const MapaSelector = dynamic(() => import('./MapaSelector'), {
  ssr: false,
  loading: () => (
    <div className="h-72 animate-pulse rounded-xl border border-black/10 bg-black/[0.03] dark:border-white/15 dark:bg-white/5" />
  ),
});

export function FormularioRegistro({
  departamentos,
  categorias,
}: {
  departamentos: Departamento[];
  categorias: Categoria[];
}) {
  const [estado, enviar, enviando] = useActionState(registrarPunto, ESTADO_INICIAL);

  /*
   * Lo que la persona había escrito antes del error.
   *
   * Llega de vuelta del servidor y se usa como `defaultValue` de cada campo:
   * es la única forma de que un formulario no controlado sobreviva a un envío
   * fallido. Sin esto, una tilde de más en el teléfono borraba media hora de
   * trabajo — que en un celular, en la calle, es motivo suficiente para no
   * volver a intentarlo.
   */
  const previos = estado.estado === 'error' ? estado.valores : {};
  const antes = (campo: string) => previos[campo] ?? '';

  const [dep, setDep] = useState(previos.departamento_codigo ?? '');
  const [mun, setMun] = useState(previos.municipio_codigo ?? '');
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);

  const supabase = useMemo(() => clienteNavegador(), []);

  useEffect(() => {
    if (!dep) return;
    let vigente = true;

    const traer = (campos: string) =>
      supabase
        .from('municipios')
        .select(campos)
        .eq('departamento_codigo', dep)
        .order('nombre');

    (async () => {
      // Con lat/lng el mapa arranca centrado en el municipio. Si la migración
      // 0003 todavía no está aplicada esas columnas no existen, y antes que
      // dejar el selector vacío se recae en los campos de siempre: el punto se
      // marca igual, solo que el mapa arranca en el centro del país.
      const conCentroide = await traer('codigo, nombre, departamento_codigo, lat, lng');
      const filas = conCentroide.error
        ? (await traer('codigo, nombre, departamento_codigo')).data
        : conCentroide.data;
      if (vigente) setMunicipios((filas as unknown as Municipio[]) ?? []);
    })();

    return () => {
      vigente = false;
    };
  }, [dep, supabase]);

  const centroMunicipio = useMemo(() => {
    const elegido = municipios.find((m) => m.codigo === mun);
    return elegido?.lat != null && elegido?.lng != null
      ? { lat: elegido.lat, lng: elegido.lng }
      : null;
  }, [municipios, mun]);

  if (estado.estado === 'listo') return <Confirmacion />;

  const errores = estado.estado === 'error' ? estado.errores : {};

  /*
   * Las categorías y el horario también vuelven.
   *
   * Las categorías llegan como campos sueltos `cat_<slug>`, igual que las manda
   * el formulario; el horario viaja como JSON en un campo oculto. Si el JSON
   * llegó roto se ignora en vez de reventar el render: peor que perder el
   * horario es perder toda la página.
   */
  const categoriasPrevias = Object.fromEntries(
    Object.entries(previos)
      .filter(([campo, valor]) => campo.startsWith('cat_') && valor !== '')
      .map(([campo, valor]) => [campo.slice(4), valor]),
  );

  const franjasPrevias = ((): Franja[] => {
    try {
      const leidas = JSON.parse(previos.horarios ?? '[]');
      return Array.isArray(leidas) ? (leidas as Franja[]) : [];
    } catch {
      return [];
    }
  })();

  const hayErrores = estado.estado === 'error';
  const camposConError = Object.entries(errores).filter(([, m]) => m && m.length > 0) as [
    string,
    string[],
  ][];

  /**
   * Lleva al campo que falló y le pone el foco.
   *
   * Se busca por el `name` del control en vez de repartir `id` por todo el
   * formulario: son treinta campos y esto no obliga a tocar ninguno. Los que no
   * son un control —las categorías, el horario— caen a su bloque por el id de
   * la sección.
   */
  const irAlCampo = (campo: string) => (evento: React.MouseEvent) => {
    evento.preventDefault();
    const formulario = (evento.currentTarget as HTMLElement).closest('form');
    const control = formulario?.elements.namedItem(campo);
    const destino =
      control instanceof HTMLElement
        ? control
        : formulario?.querySelector<HTMLElement>(`#bloque-${campo}`);

    destino?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (control instanceof HTMLElement && 'focus' in control) control.focus({ preventScroll: true });
  };
  const mensajeError = hayErrores
    ? (estado.mensaje ?? 'Revisa los campos marcados y vuelve a enviar.')
    : null;

  return (
    <form action={enviar} className="flex flex-col gap-8" noValidate>
      {mensajeError && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm font-medium text-red-800 dark:text-red-300"
        >
          {mensajeError}
        </p>
      )}

      <Bloque titulo="El punto de acopio">
        <Campo etiqueta="Nombre del punto" error={errores.nombre}>
          <input
            name="nombre"
            required
            defaultValue={antes('nombre')}
            placeholder="Parroquia San José, Coliseo Municipal…"
            className={CLASE_ENTRADA}
          />
        </Campo>

        <Campo etiqueta="¿Quién lo organiza?" error={errores.tipo_organizacion}>
          <select
            name="tipo_organizacion"
            required
            defaultValue={antes('tipo_organizacion')}
            className={CLASE_ENTRADA}
          >
            <option value="" disabled>Elige una opción</option>
            {(Object.keys(TIPOS_ORGANIZACION) as TipoOrganizacion[]).map((tipo) => (
              <option key={tipo} value={tipo}>{TIPOS_ORGANIZACION[tipo]}</option>
            ))}
          </select>
        </Campo>
      </Bloque>

      <Bloque titulo="Dónde queda">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Departamento" error={errores.departamento_codigo}>
            <select
              name="departamento_codigo"
              required
              value={dep}
              onChange={(e) => {
                // Limpiar acá y no en un efecto: cambiar de departamento invalida
                // el municipio elegido, y este es el evento que lo provoca.
                setDep(e.target.value);
                setMun('');
                setMunicipios([]);
              }}
              className={CLASE_ENTRADA}
            >
              <option value="" disabled>Elige el departamento</option>
              {departamentos.map((d) => (
                <option key={d.codigo} value={d.codigo}>{d.nombre}</option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Municipio" error={errores.municipio_codigo}>
            <select
              name="municipio_codigo"
              required
              value={mun}
              onChange={(e) => setMun(e.target.value)}
              disabled={!dep}
              className={CLASE_ENTRADA}
            >
              <option value="" disabled>
                {dep ? 'Elige el municipio' : 'Primero el departamento'}
              </option>
              {municipios.map((m) => (
                <option key={m.codigo} value={m.codigo}>{m.nombre}</option>
              ))}
            </select>
          </Campo>
        </div>

        <Campo etiqueta="Dirección" error={errores.direccion}>
          <input
            name="direccion"
            required
            defaultValue={antes('direccion')}
            placeholder="Calle 12 # 4-30"
            className={CLASE_ENTRADA}
          />
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Barrio o vereda" opcional error={errores.barrio}>
            <input name="barrio" defaultValue={antes('barrio')} className={CLASE_ENTRADA} />
          </Campo>
          <Campo
            etiqueta="Cómo ubicarlo"
            opcional
            ayuda="Un punto de referencia vale más que la nomenclatura"
            error={errores.referencia}
          >
            <input
              name="referencia"
              defaultValue={antes('referencia')}
              placeholder="Frente al parque, portón azul"
              className={CLASE_ENTRADA}
            />
          </Campo>
        </div>

        {/*
          Un <div>, NO el componente `Campo`.
          `Campo` envuelve a sus hijos en un <label>, y un <label> reenvía cada
          clic a su primer control: acá ese control es el botón "Usar mi
          ubicación" que va dentro del mapa. Con el mapa adentro del label, cada
          toque para mover el pin activaba el botón, salía "Buscando…" y, cuando
          el navegador respondía, el mapa se iba a la ubicación de la persona sin
          que nadie se lo hubiera pedido.

          Un <label> es para un control. Un mapa no es un control.
        */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Marca el punto en el mapa</span>
          {/*
            El centro es el del municipio y nada más. Pasarle acá la coordenada
            del pin hacía que cada arrastre volviera a entrar por el efecto que
            recentra: uno movía y el mapa se devolvía. El pin sale del mapa; el
            mapa no debe salir del pin.
          */}
          <MapaSelector
            centroMunicipio={centroMunicipio}
            alCambiar={(lat, lng) => setCoordenadas({ lat, lng })}
          />
          <p className="text-sm text-black/55 dark:text-white/55">
            Arranca en el centro del municipio. Si estás en el punto, «Usar mi
            ubicación» es lo más rápido; si no, mueve el mapa hasta la entrada.
          </p>
        </div>

        <input type="hidden" name="lat" value={coordenadas?.lat ?? ''} />
        <input type="hidden" name="lng" value={coordenadas?.lng ?? ''} />
      </Bloque>

      <Bloque titulo="Cuándo reciben">
        <div id="bloque-horarios" />
        {errores.horarios && (
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            {errores.horarios[0]}
          </p>
        )}
        <SelectorHorario franjas={franjasPrevias} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Desde" opcional error={errores.fecha_inicio}>
            <input
              type="date"
              name="fecha_inicio"
              defaultValue={antes('fecha_inicio')}
              className={CLASE_ENTRADA}
            />
          </Campo>
          <Campo etiqueta="Hasta" opcional error={errores.fecha_fin}>
            <input
              type="date"
              name="fecha_fin"
              defaultValue={antes('fecha_fin')}
              className={CLASE_ENTRADA}
            />
          </Campo>
        </div>
      </Bloque>

      <Bloque
        titulo="Qué reciben"
        ayuda="Marcar «No llevar» es igual de importante que marcar lo que sí: evita que lleguen cosas que toca botar."
      >
        <div id="bloque-categorias" />
        {errores.categorias && (
          <p className="text-sm font-medium text-red-700 dark:text-red-400">{errores.categorias[0]}</p>
        )}
        <SelectorCategorias categorias={categorias} valores={categoriasPrevias} />
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="recibe_voluntarios"
            defaultChecked={previos.recibe_voluntarios !== undefined}
            className="size-4"
          />
          <span className="text-sm">También necesitamos voluntarios</span>
        </label>
      </Bloque>

      <Bloque titulo="Quién responde">
        <Campo etiqueta="Nombre del responsable" error={errores.responsable_nombre}>
          <input
            name="responsable_nombre"
            required
            defaultValue={antes('responsable_nombre')}
            className={CLASE_ENTRADA}
          />
        </Campo>

        <Campo
          etiqueta="Teléfono"
          ayuda="Si no tienen un número que contesten, déjalo vacío y escribe el Instagram abajo"
          error={errores.telefono}
        >
          <input
            name="telefono"
            type="tel"
            inputMode="tel"
            defaultValue={antes('telefono')}
            placeholder="300 123 4567"
            className={CLASE_ENTRADA}
          />
        </Campo>

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            name="whatsapp"
            defaultChecked={estado.estado === 'error' ? previos.whatsapp !== undefined : true}
            className="mt-0.5 size-4"
          />
          <span className="text-sm">Ese número recibe WhatsApp</span>
        </label>

        {/*
          Instagram no pasa por la casilla de Habeas Data del teléfono: son cosas
          distintas. Un celular es un dato personal que hay que autorizar; una
          cuenta de Instagram escrita en un campo que dice "se publica" ya es
          pública, y es justo por donde quieren que les escriban.
        */}
        <Campo
          etiqueta="Instagram del punto"
          ayuda="Se publica. Es el contacto para los puntos que se coordinan por ahí"
          error={errores.instagram}
        >
          <input
            name="instagram"
            inputMode="text"
            autoCapitalize="none"
            defaultValue={antes('instagram')}
            placeholder="@acopiobarrioabajo"
            className={CLASE_ENTRADA}
          />
        </Campo>

        <label className="flex items-start gap-2.5 rounded-lg bg-black/[0.03] p-3 dark:bg-white/5">
          <input
            type="checkbox"
            name="telefono_publico"
            defaultChecked={previos.telefono_publico !== undefined}
            className="mt-0.5 size-4"
          />
          <span className="text-sm">{AVISOS.habeasData}</span>
        </label>

        <Campo
          etiqueta="Correo electrónico"
          opcional
          ayuda="No se publica. Le sirve a moderación para escribirte si no contesta el teléfono."
          error={errores.correo}
        >
          <input
            name="correo"
            type="email"
            defaultValue={antes('correo')}
            className={CLASE_ENTRADA}
          />
        </Campo>

        <Campo etiqueta="Algo más que deban saber" opcional error={errores.notas}>
          <textarea
            name="notas"
            rows={3}
            defaultValue={antes('notas')}
            placeholder="Hay parqueadero, se puede descargar en carro…"
            className={CLASE_ENTRADA}
          />
        </Campo>
      </Bloque>

      {/* Trampa para bots. Invisible para quien navega y para lectores de pantalla. */}
      <input
        type="text"
        name="sitio_web"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />

      <div className="flex flex-col gap-3">
        {/*
          El mismo aviso, otra vez, justo encima del botón.
          El de arriba no lo ve nadie: quien envía está al final del formulario y
          se queda mirando el botón sin saber si pasó algo. Repetirlo acá es feo
          en un diseño y correcto en un formulario largo.
        */}
        {hayErrores && (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-300"
          >
            <p className="font-semibold">{mensajeError}</p>
            {camposConError.length > 0 && (
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {camposConError.map(([campo, mensajes]) => (
                  <li key={campo}>
                    <a
                      href={`#bloque-${campo}`}
                      onClick={irAlCampo(campo)}
                      className="underline underline-offset-4"
                    >
                      {ETIQUETAS[campo] ?? campo}
                    </a>
                    : {mensajes[0]}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-red-800/80 dark:text-red-300/80">
              Lo que ya habías escrito sigue ahí: solo corrige lo señalado.
            </p>
          </div>
        )}
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-emerald-700 px-6 py-3.5 text-base font-semibold text-white disabled:opacity-60 dark:bg-emerald-600"
        >
          {enviando ? 'Enviando…' : 'Enviar para revisión'}
        </button>
        <p className="text-sm text-black/60 dark:text-white/60">
          Un moderador revisa el punto antes de publicarlo. {AVISOS.sinDinero}
        </p>
      </div>
    </form>
  );
}

function Confirmacion() {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-2xl font-bold">Listo, quedó registrado</h2>
      <p className="text-black/80 dark:text-white/80">
        Un moderador va a llamarte al teléfono que dejaste para confirmar antes
        de publicarlo. Mientras tanto el punto no aparece en el directorio.
      </p>

      <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/15 dark:bg-white/5">
        <p className="font-semibold">¿Y si después cambia algo?</p>
        <p className="text-sm text-black/70 dark:text-white/70">
          Cuando el punto esté publicado, en su página vas a encontrar el botón{' '}
          <strong>«Solicitar un cambio o el cierre»</strong>. Nos escribes qué
          cambió y moderación lo actualiza. No necesitas cuenta ni contraseña, y
          no hay ningún código que guardar.
        </p>
      </div>

      <Link
        href="/"
        className="self-start rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-black"
      >
        Ver los puntos publicados
      </Link>
    </section>
  );
}

/** Cómo se llama cada campo en el resumen de errores, en cristiano. */
const ETIQUETAS: Record<string, string> = {
  nombre: 'Nombre del punto',
  tipo_organizacion: 'Quién lo organiza',
  departamento_codigo: 'Departamento',
  municipio_codigo: 'Municipio',
  direccion: 'Dirección',
  barrio: 'Barrio',
  referencia: 'Cómo ubicarlo',
  horarios: 'Horario',
  fecha_inicio: 'Fecha de inicio',
  fecha_fin: 'Fecha de cierre',
  categorias: 'Qué reciben',
  responsable_nombre: 'Nombre del responsable',
  telefono: 'Teléfono',
  instagram: 'Instagram',
  correo: 'Correo',
  notas: 'Notas',
};

const CLASE_ENTRADA =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-base disabled:opacity-50 dark:border-white/20';

function Bloque({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        {ayuda && <p className="text-sm text-black/60 dark:text-white/60">{ayuda}</p>}
      </div>
      {children}
    </section>
  );
}

function Campo({
  etiqueta,
  ayuda,
  opcional,
  error,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  opcional?: boolean;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {etiqueta}
        {opcional && <span className="font-normal text-black/50 dark:text-white/50"> (opcional)</span>}
      </span>
      {ayuda && <span className="text-sm text-black/60 dark:text-white/60">{ayuda}</span>}
      {children}
      {error?.[0] && (
        <span className="text-sm font-medium text-red-700 dark:text-red-400">{error[0]}</span>
      )}
    </label>
  );
}
