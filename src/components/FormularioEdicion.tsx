'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { SelectorCategorias } from './SelectorCategorias';
import { SelectorHorario } from './SelectorHorario';
import { guardarPunto } from '@/app/admin/acciones';
import { EDICION_INICIAL } from '@/lib/estados';
import type { Franja } from '@/lib/horarios';
import { TIPOS_ORGANIZACION } from '@/lib/textos';
import type { Categoria, TipoOrganizacion } from '@/lib/tipos';

// Leaflet toca el `window` al importarse: no puede renderizarse en el servidor.
const MapaSelector = dynamic(() => import('./MapaSelector'), {
  ssr: false,
  loading: () => (
    <div className="h-72 animate-pulse rounded-xl border border-black/10 bg-black/[0.03] dark:border-white/15 dark:bg-white/5" />
  ),
});

export interface PuntoEditable {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  tipo_organizacion: TipoOrganizacion;
  departamento_codigo: string;
  municipio_codigo: string;
  direccion: string;
  barrio: string | null;
  referencia: string | null;
  responsable_nombre: string;
  telefono: string;
  instagram: string | null;
  whatsapp: boolean;
  telefono_publico: boolean;
  correo: string | null;
  horarios: Franja[];
  fecha_inicio: string | null;
  fecha_fin: string | null;
  recibe_voluntarios: boolean;
  notas: string | null;
  categorias: Record<string, string>;
}

/**
 * Edición de un punto desde moderación.
 *
 * Es la contraparte de D9: como el público no edita, alguien tiene que poder.
 * Es sobre todo la herramienta para aplicar lo que sale de la ronda de llamadas
 * y de la bandeja de solicitudes.
 *
 * Guardar cuenta como verificación: si alguien tocó esta ficha, es porque acaba
 * de hablar con el punto.
 */
export function FormularioEdicion({
  punto,
  categorias,
}: {
  punto: PuntoEditable;
  categorias: Categoria[];
}) {
  const [estado, enviar, guardando] = useActionState(guardarPunto, EDICION_INICIAL);
  const errores = estado.estado === 'error' ? estado.errores : {};

  const [coordenadas, setCoordenadas] = useState({ lat: punto.lat, lng: punto.lng });

  /*
   * El centro del mapa TIENE que ser un objeto estable.
   *
   * Pasarlo como literal en el JSX creaba uno nuevo en cada render, y eso
   * encendía un bucle: el efecto de `MapaSelector` que recentra el mapa se
   * disparaba, `setView` emitía `moveend`, `moveend` llamaba a `setCoordenadas`,
   * el render siguiente creaba otro literal, y vuelta a empezar.
   *
   * Desde afuera no se veía como un bucle sino como una página muerta: el botón
   * se quedaba en "Guardando…" para siempre y los enlaces no respondían, porque
   * React no alcanzaba a procesar nada más.
   */
  const centro = useMemo(
    () => ({ lat: punto.lat, lng: punto.lng }),
    [punto.lat, punto.lng],
  );
  const movido =
    Math.abs(coordenadas.lat - punto.lat) > 0.00001 ||
    Math.abs(coordenadas.lng - punto.lng) > 0.00001;

  return (
    <form action={enviar} className="flex flex-col gap-7" noValidate>
      <input type="hidden" name="id" value={punto.id} />
      {/* El municipio no se edita acá: cambiarlo dejaría la ubicación del mapa
          en otro lado. Si está mal, se rechaza y se vuelve a registrar. */}
      <input type="hidden" name="departamento_codigo" value={punto.departamento_codigo} />
      <input type="hidden" name="municipio_codigo" value={punto.municipio_codigo} />

      {estado.estado === 'guardado' && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm font-medium">
          Guardado. El punto quedó marcado como verificado ahora.
        </p>
      )}
      {estado.estado === 'error' && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm font-medium text-red-800 dark:text-red-300">
          {estado.mensaje ?? 'Revisa los campos marcados.'}
        </p>
      )}

      <Campo etiqueta="Nombre" error={errores.nombre}>
        <input name="nombre" defaultValue={punto.nombre} className={ENTRADA} />
      </Campo>

      <Campo etiqueta="Tipo de organización" error={errores.tipo_organizacion}>
        <select name="tipo_organizacion" defaultValue={punto.tipo_organizacion} className={ENTRADA}>
          {(Object.keys(TIPOS_ORGANIZACION) as TipoOrganizacion[]).map((t) => (
            <option key={t} value={t}>{TIPOS_ORGANIZACION[t]}</option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Dirección" error={errores.direccion}>
        <input name="direccion" defaultValue={punto.direccion} className={ENTRADA} />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Barrio" error={errores.barrio}>
          <input name="barrio" defaultValue={punto.barrio ?? ''} className={ENTRADA} />
        </Campo>
        <Campo etiqueta="Cómo ubicarlo" error={errores.referencia}>
          <input name="referencia" defaultValue={punto.referencia ?? ''} className={ENTRADA} />
        </Campo>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Dónde queda</h2>
        <p className="text-sm text-black/65 dark:text-white/65">
          Mueve el mapa hasta que el pin quede sobre la entrada. Los puntos que
          se cargaron desde una lista suelen quedar en el centro de la ciudad
          hasta que alguien los ubica.
        </p>
        {/* El municipio sigue sin editarse: el pin se mueve dentro del mismo
            municipio. Cambiar de municipio es rechazar y volver a registrar. */}
        <MapaSelector
          centroMunicipio={centro}
          alCambiar={(lat, lng) => setCoordenadas({ lat, lng })}
        />
        <input type="hidden" name="lat" value={coordenadas.lat} />
        <input type="hidden" name="lng" value={coordenadas.lng} />
        <p className="text-sm text-black/55 dark:text-white/55">
          {movido ? 'Pin movido. ' : ''}
          {coordenadas.lat.toFixed(5)}, {coordenadas.lng.toFixed(5)}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Horario</h2>
        {errores.horarios && (
          <p className="text-sm font-medium text-red-700 dark:text-red-400">{errores.horarios[0]}</p>
        )}
        <SelectorHorario franjas={punto.horarios} />
        <p className="text-sm text-black/55 dark:text-white/55">
          Si todavía no se sabe, se puede dejar sin marcar y guardar igual. El
          punto simplemente no muestra el sello de «Abierto ahora» hasta que
          alguien confirme el horario.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Desde" error={errores.fecha_inicio}>
            <input type="date" name="fecha_inicio" defaultValue={punto.fecha_inicio ?? ''} className={ENTRADA} />
          </Campo>
          <Campo etiqueta="Hasta" error={errores.fecha_fin}>
            <input type="date" name="fecha_fin" defaultValue={punto.fecha_fin ?? ''} className={ENTRADA} />
          </Campo>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Qué reciben</h2>
        {errores.categorias && (
          <p className="text-sm font-medium text-red-700 dark:text-red-400">{errores.categorias[0]}</p>
        )}
        <SelectorCategorias categorias={categorias} valores={punto.categorias} />
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="recibe_voluntarios"
            defaultChecked={punto.recibe_voluntarios}
            className="size-4"
          />
          <span className="text-sm">También necesitan voluntarios</span>
        </label>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold">Contacto</h2>
        <Campo etiqueta="Responsable" error={errores.responsable_nombre}>
          <input name="responsable_nombre" defaultValue={punto.responsable_nombre} className={ENTRADA} />
        </Campo>
        <Campo etiqueta="Teléfono" error={errores.telefono}>
          <input name="telefono" defaultValue={punto.telefono} className={ENTRADA} />
        </Campo>
        <p className="-mt-2 text-sm text-black/55 dark:text-white/55">
          Si no hay un número que contesten, déjalo en «Por confirmar» y llena el
          Instagram. La ficha deja de ofrecer «Llamar» en vez de mandar a marcar
          a la nada.
        </p>

        <Campo etiqueta="Instagram del punto" error={errores.instagram}>
          <input
            name="instagram"
            defaultValue={punto.instagram ?? ''}
            autoCapitalize="none"
            placeholder="@acopiobarrioabajo"
            className={ENTRADA}
          />
        </Campo>
        <label className="flex items-center gap-2.5">
          <input type="checkbox" name="whatsapp" defaultChecked={punto.whatsapp} className="size-4" />
          <span className="text-sm">Ese número recibe WhatsApp</span>
        </label>
        <label className="flex items-start gap-2.5 rounded-lg bg-black/[0.03] p-3 dark:bg-white/5">
          <input
            type="checkbox"
            name="telefono_publico"
            defaultChecked={punto.telefono_publico}
            className="mt-0.5 size-4"
          />
          <span className="text-sm">
            Autorizó publicar su teléfono. <strong>No marcar sin confirmarlo</strong>:
            es consentimiento de datos personales (Ley 1581 de 2012).
          </span>
        </label>
        <Campo etiqueta="Correo" error={errores.correo}>
          <input name="correo" type="email" defaultValue={punto.correo ?? ''} className={ENTRADA} />
        </Campo>
        <Campo etiqueta="Notas" error={errores.notas}>
          <textarea name="notas" rows={3} defaultValue={punto.notas ?? ''} className={ENTRADA} />
        </Campo>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-emerald-700 px-6 py-3 text-base font-semibold text-white disabled:opacity-60 dark:bg-emerald-600"
        >
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <Link href="/admin" className="text-sm underline underline-offset-4">
          Volver a moderación
        </Link>
      </div>
    </form>
  );
}

const ENTRADA =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-base dark:border-white/20';

function Campo({
  etiqueta,
  error,
  children,
}: {
  etiqueta: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{etiqueta}</span>
      {children}
      {error?.[0] && (
        <span className="text-sm font-medium text-red-700 dark:text-red-400">{error[0]}</span>
      )}
    </label>
  );
}
