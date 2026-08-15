import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
