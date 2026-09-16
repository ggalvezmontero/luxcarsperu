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
      { label: "Gestión documentaria", href: "/#contact" },
    ],
  },
  {
    title: "Recursos",
    links: [
      { label: "Calculadora de importación", href: "/#calculator" },
      { label: "Cómo funciona", href: "/como-funciona" },
      { label: "Preguntas frecuentes", href: "/faq" },
      { label: "Contacto", href: "/#contact" },
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

export function Footer() {
  const { contact, legalName, ruc } = LUXCARS_CONFIG;
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
                <a href={`https://wa.me/${contact.whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-ink">
                  {contact.phone}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Icon name="mail" size={18} className="shrink-0 text-silver-dim" />
                <a href={`mailto:${contact.email}`} className="transition-colors hover:text-ink">
                  {contact.email}
                </a>
              </li>
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
