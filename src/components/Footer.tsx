import { LUXCARS_CONFIG } from "@/lib/config";
import Image from "next/image";
import Link from "next/link";
import { Icon, WhatsAppIcon } from "./ui/Icon";

const CURRENT_YEAR = 2026;

const COLUMNS = [
  {
    title: "Servicios",
    links: [
      { label: "Comprar un auto", href: "/comprar" },
      { label: "Importar a pedido", href: "/importar" },
      { label: "Vender o consignar", href: "/vender" },
      { label: "Escaneo pre-compra", href: "/escaneo" },
      { label: "Gestión documentaria", href: "/#contact" },
    ],
  },
  {
    title: "Recursos",
    links: [
      { label: "Calculadora de importación", href: "/calculadora" },
      { label: "Guías para importar", href: "/guias" },
      { label: "Cómo funciona", href: "/como-funciona" },
      { label: "Preguntas frecuentes", href: "/faq" },
      { label: "Contacto", href: "/#contact" },
      { label: "Mi cuenta", href: "/cuenta" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Términos y condiciones", href: "/terminos" },
      { label: "Política de privacidad", href: "/privacidad" },
      { label: "Política de cookies", href: "/cookies" },
    ],
  },
];

/** Iconos de marca (trazos oficiales simplificados, un solo color). */
const REDES: { id: keyof typeof LUXCARS_CONFIG.social; nombre: string; path: string }[] = [
  {
    id: "instagram",
    nombre: "Instagram",
    path: "M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1.1.4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1.1.4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1.1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1.1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1 0-1.5.2-1.8.3-.4.2-.7.3-1 .7-.3.3-.5.6-.7 1-.1.3-.3.7-.3 1.8C3.4 9 3.4 9.3 3.4 12s0 3.1.1 4.3c0 1.1.2 1.5.3 1.8.2.4.3.7.7 1 .3.3.6.5 1 .7.3.1.7.3 1.8.3 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1 0 1.5-.2 1.8-.3.4-.2.7-.3 1-.7.3-.3.5-.6.7-1 .1-.3.3-.7.3-1.8.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c0-1.1-.2-1.5-.3-1.8-.2-.4-.3-.7-.7-1-.3-.3-.6-.5-1-.7-.3-.1-.7-.3-1.8-.3C15.5 4 15.1 4 12 4zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zm5.2-3.1a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z",
  },
  {
    id: "facebook",
    nombre: "Facebook",
    path: "M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.2-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9z",
  },
  {
    id: "tiktok",
    nombre: "TikTok",
    path: "M16.6 3c.3 2.2 1.6 3.7 3.8 3.9v3c-1.4 0-2.7-.4-3.8-1.2v6.4c0 3.6-2.9 5.9-5.8 5.9-3.1 0-5.6-2.5-5.6-5.6 0-3.3 2.8-5.9 6.2-5.5v3.1c-1.6-.4-3.1.8-3.1 2.4 0 1.4 1.1 2.5 2.5 2.5 1.5 0 2.7-1.1 2.7-2.9V3h3.1z",
  },
];

export function Footer() {
  const { contact, legalName, ruc, social } = LUXCARS_CONFIG;
  return (
    <footer className="w-full border-t border-line bg-void">
      <div className="container-lux py-14 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Image
              src="/brand/logo-blanco.svg"
              alt={LUXCARS_CONFIG.brandName}
              width={1010}
              height={590}
              className="h-20 w-auto"
            />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-ink-3">
              Autos premium en Lima: stock propio, importación a pedido desde
              Estados Unidos y consignación sin exclusividad.
            </p>
            <ul className="mt-7 space-y-3 text-sm text-ink-2">
              <li className="flex items-start gap-3">
                <Icon name="mapPin" size={18} className="mt-0.5 shrink-0 text-silver-dim" />
                <span>{contact.address}, {contact.city}</span>
              </li>
              <li className="flex items-center gap-3">
                <WhatsAppIcon size={18} className="shrink-0 text-silver-dim" />
                <a href={`https://wa.me/${contact.whatsappNumber}`} target="_blank" rel="noopener noreferrer" data-ga-cta="footer_whatsapp" className="transition-colors hover:text-ink">
                  {contact.phone}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Icon name="mail" size={18} className="shrink-0 text-silver-dim" />
                <a href={`mailto:${contact.email}`} data-ga-cta="footer_correo" className="transition-colors hover:text-ink">
                  {contact.email}
                </a>
              </li>
            </ul>
            {/* Redes oficiales: las mismas URLs que el `sameAs` del JSON-LD. */}
            <ul className="mt-6 flex items-center gap-3" aria-label="Redes sociales">
              {REDES.map((red) => (
                <li key={red.nombre}>
                  <a
                    href={social[red.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${LUXCARS_CONFIG.brandName} en ${red.nombre}`}
                    data-ga-cta={`footer_${red.id}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-3 transition-colors hover:border-silver hover:text-ink"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                      <path d={red.path} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8 lg:pl-12">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-silver">
                  {col.title}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm text-ink-3 transition-colors hover:text-ink">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-line pt-6 text-xs text-ink-4 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {CURRENT_YEAR} {legalName} · RUC {ruc}
          </p>
          <p>Estimados referenciales. Tributos sujetos a determinación de SUNAT.</p>
        </div>
      </div>
    </footer>
  );
}
