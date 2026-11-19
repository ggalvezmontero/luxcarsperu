import Image from "next/image";
import Link from "next/link";

import { FOTOS_PROCESO } from "@/lib/fotosProceso";
import { LUXCARS_CONFIG } from "@/lib/config";

import { Button } from "../Button";
import { CreditoFoto } from "../CreditoFoto";
import { Icon, WhatsAppIcon } from "../ui/Icon";

const WA = `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}?text=${encodeURIComponent(
  "Hola Luxcars, busco un auto que no está en su stock. Les cuento cuál:",
)}`;

/**
 * Tarjeta "lo buscamos por ti" que acompaña al stock cuando hay pocas
 * unidades: con una sola tarjeta en una rejilla de tres, la página se veía
 * vacía. Ocupa el espacio con la promesa real del negocio (búsqueda en Lima o
 * importación a pedido) sobre una foto, y lleva a WhatsApp o a /comprar.
 */
export function BusquedaCard({ className = "" }: { className?: string }) {
  const foto = FOTOS_PROCESO.busqueda;
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="relative isolate flex min-h-[320px] flex-1 flex-col justify-end overflow-hidden panel-lux p-6 sm:p-8">
        <Image src={foto.src} alt={foto.alt} fill sizes="(min-width: 1024px) 40vw, 100vw" className="-z-20 object-cover" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-void via-void/80 to-void/20" />
        <p className="eyebrow">¿No está el que buscas?</p>
        <h3 className="mt-3 text-balance text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
          Lo buscamos en Lima o lo traemos <span className="display-accent">de Estados Unidos.</span>
        </h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-2">
          Nos dices modelo, año y presupuesto. Lo verificamos antes de que pongas un sol y te lo confirmamos por escrito.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button href={WA} variant="whatsapp" size="md" data-ga-cta="stock_busqueda_whatsapp">
            <WhatsAppIcon size={18} />
            Dime qué buscas
          </Button>
          <Button href="/importar" variant="secondary" size="md" data-ga-cta="stock_busqueda_importar">
            Importar a pedido
            <Icon name="arrowRight" size={16} />
          </Button>
        </div>
        <Link href="/comprar#busqueda" className="sr-only">Búsqueda y verificación en Lima</Link>
      </div>
      {foto.credito ? (
        <CreditoFoto credito={foto.credito.autor} licencia={foto.credito.licencia} fuenteUrl={foto.credito.fuenteUrl} className="mt-2 px-1" />
      ) : null}
    </div>
  );
}
