import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RegistrarServiceWorker } from "@/components/RegistrarServiceWorker";
import { SITIO } from "@/lib/textos";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sitioUrl = process.env.NEXT_PUBLIC_SITIO_URL ?? `https://${SITIO.dominio}`;

export const metadata: Metadata = {
  metadataBase: new URL(sitioUrl),
  title: {
    default: `${SITIO.nombre} — ${SITIO.lema}`,
    template: `%s · ${SITIO.nombre}`,
  },
  description: SITIO.descripcion,
  // La mayoría del tráfico va a entrar por un link compartido en WhatsApp:
  // la tarjeta de Open Graph es parte de la interfaz, no un adorno.
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: SITIO.nombre,
    title: `${SITIO.nombre} — ${SITIO.lema}`,
    description: SITIO.descripcion,
    url: sitioUrl,
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icono.svg", type: "image/svg+xml" }],
    apple: "/icono.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#047857",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/*
          Saltar al contenido. Solo aparece al tabular, y es lo que evita que
          quien navega con teclado o lector de pantalla tenga que pasar por el
          encabezado en cada página.
        */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-black focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white dark:focus:bg-white dark:focus:text-black"
        >
          Saltar al contenido
        </a>
        <div id="contenido" tabIndex={-1} className="flex min-h-full flex-1 flex-col">
          {children}
        </div>
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
