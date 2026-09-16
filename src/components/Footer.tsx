'use client';

import { LUXCARS_CONFIG } from "@/lib/config";
import Image from "next/image";
import Link from "next/link";

const CURRENT_YEAR = new Date().getFullYear();

const FOOTER_LINKS = {
  services: [
    { label: "Calculadora de Importación", href: "/#calculator" },
    { label: "Cómo Funciona", href: "/como-funciona" },
    { label: "Marcas Disponibles", href: "/como-funciona#brands" },
    { label: "Timeline de Entrega", href: "/#timeline" },
  ],
  company: [
    { label: "Por Qué Nosotros", href: "/como-funciona#why-us" },
    { label: "Sitios de Búsqueda", href: "/como-funciona#websites" },
    { label: "Preguntas Frecuentes", href: "/faq" },
    { label: "Contacto", href: "/#contact" },
  ],
  legal: [
    { label: "Términos y Condiciones", href: "/terminos" },
    { label: "Política de Privacidad", href: "/privacidad" },
    { label: "Política de Cookies", href: "/cookies" },
  ],
};

const SOCIAL_LINKS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/luxcars.pe",
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@luxcars.pe",
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
      </svg>
    ),
  },
  {
    label: "WhatsApp",
    href: `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}`,
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
    ),
  },
];

const COLUMN_HEADING =
  "text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-silver";
const COLUMN_LINK =
  "text-sm leading-relaxed text-ink-3 transition-colors hover:text-ink";

export function Footer() {
  return (
    <footer className="w-full border-t border-line bg-void">
      {/* Main Footer Content */}
      <div className="mx-auto w-full max-w-[1440px] px-6 py-14 sm:px-10 lg:px-12 lg:py-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-16">
          {/* Brand + contacto */}
          <div className="min-w-0 lg:col-span-4">
            <Image
              src="/brand/luxcars-blanco.svg"
              alt={`${LUXCARS_CONFIG.brandName} — importación de autos de lujo`}
              width={1254}
              height={1254}
              className="h-10 w-auto"
            />
            <p className="mt-3 text-[0.6875rem] uppercase tracking-[0.3em] text-silver-dim">
              Miami · Lima
            </p>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-ink-3">
              Broker boutique especializado en importación de autos de lujo y exóticos desde Miami.
              Servicio concierge completo con transparencia total.
            </p>

            <dl className="mt-8 space-y-4 text-sm">
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-4">
                  WhatsApp
                </dt>
                <dd className="mt-1">
                  <a
                    href={`https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-silver-bright transition-colors hover:text-ink"
                  >
                    +{LUXCARS_CONFIG.contact.whatsappNumber}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-4">
                  Email
                </dt>
                <dd className="mt-1">
                  <a
                    href={`mailto:${LUXCARS_CONFIG.contact.email}`}
                    className="break-words text-ink transition-colors hover:text-silver-bright"
                  >
                    {LUXCARS_CONFIG.contact.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-4">
                  Oficina
                </dt>
                <dd className="mt-1 text-ink-2">
                  {LUXCARS_CONFIG.contact.address}
                  <span className="mt-1 block text-xs italic text-ink-4">
                    Reuniones presenciales con cita previa
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Columnas de navegación */}
          <div className="min-w-0 lg:col-span-8">
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:gap-x-8 md:grid-cols-4">
              {/* Líneas de negocio */}
              <div className="min-w-0">
                <h3 className={COLUMN_HEADING}>Líneas de negocio</h3>
                <ul className="mt-5 space-y-3">
                  {LUXCARS_CONFIG.businessLines.map((line) => (
                    <li
                      key={line.id}
                      className="border-l border-line pl-3 text-sm leading-relaxed text-ink-2"
                    >
                      {line.label}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Services */}
              <div className="min-w-0">
                <h3 className={COLUMN_HEADING}>Servicios</h3>
                <ul className="mt-5 space-y-3">
                  {FOOTER_LINKS.services.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className={COLUMN_LINK}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Company */}
              <div className="min-w-0">
                <h3 className={COLUMN_HEADING}>Empresa</h3>
                <ul className="mt-5 space-y-3">
                  {FOOTER_LINKS.company.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className={COLUMN_LINK}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Legal */}
              <div className="min-w-0">
                <h3 className={COLUMN_HEADING}>Legal</h3>
                <ul className="mt-5 space-y-3">
                  {FOOTER_LINKS.legal.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className={COLUMN_LINK}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Identidad corporativa */}
            <div className="mt-12 border-t border-line pt-8">
              <h3 className={COLUMN_HEADING}>Razón social</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                <p className="min-w-0 text-ink-2">
                  <span className="block text-[0.6875rem] uppercase tracking-[0.18em] text-ink-4">
                    Empresa
                  </span>
                  <span className="mt-1 block break-words text-ink">
                    {LUXCARS_CONFIG.legalName}
                  </span>
                </p>
                <p className="min-w-0 text-ink-2">
                  <span className="block text-[0.6875rem] uppercase tracking-[0.18em] text-ink-4">
                    RUC
                  </span>
                  <span className="mt-1 block font-mono text-ink">
                    {LUXCARS_CONFIG.ruc}
                  </span>
                </p>
                <p className="min-w-0 text-ink-2">
                  <span className="block text-[0.6875rem] uppercase tracking-[0.18em] text-ink-4">
                    Dominio oficial
                  </span>
                  <span className="mt-1 block text-ink">LuxCars.pe</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="mt-14 border-t border-line pt-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-5">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-lux border border-line text-ink-3 transition-colors hover:border-line-strong hover:text-silver-bright"
                  aria-label={social.label}
                >
                  {social.icon}
                </a>
              ))}
            </div>
            <p className="text-center text-xs tracking-wide text-ink-4 sm:text-right">
              Hecho en Lima &amp; Miami
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-line bg-bg">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center justify-between gap-4 px-6 py-5 sm:flex-row sm:px-10 lg:px-12">
          <p className="text-center text-xs text-ink-4 sm:text-left">
            © {CURRENT_YEAR} {LUXCARS_CONFIG.brandName}. Todos los derechos reservados.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-ink-4">
            <Link href="/terminos" className="transition-colors hover:text-ink-2">
              Términos
            </Link>
            <span aria-hidden="true" className="text-line-strong">·</span>
            <Link href="/privacidad" className="transition-colors hover:text-ink-2">
              Privacidad
            </Link>
            <span aria-hidden="true" className="text-line-strong">·</span>
            <Link href="/cookies" className="transition-colors hover:text-ink-2">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
