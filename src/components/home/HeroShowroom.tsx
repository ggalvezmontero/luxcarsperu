import { LUXCARS_CONFIG } from "@/lib/config";
import Image from "next/image";
import Link from "next/link";
import { Button } from "../Button";
import { Icon, WhatsAppIcon, type IconName } from "../ui/Icon";

const PATHS: { label: string; hint: string; href: string; icon: IconName }[] = [
  { label: "Comprar", hint: "Stock en Lima", href: "/comprar", icon: "car" },
  { label: "Importar", hint: "A pedido desde EE.UU.", href: "/importar", icon: "ship" },
  { label: "Vender", hint: "Sin exclusividad", href: "/vender", icon: "tag" },
  { label: "Trámites", hint: "Placas y transferencias", href: "/#contact", icon: "fileCheck" },
];

const TRUST = [
  { icon: "shield" as IconName, text: "Inspección antes de pagar" },
  { icon: "fileCheck" as IconName, text: "Papeles en regla" },
  { icon: "calculator" as IconName, text: "Costo real antes de decidir" },
];

export function HeroShowroom() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[92svh] w-full items-end overflow-hidden bg-void pt-[var(--lux-nav-h)]"
    >
      <Image
        src="/images/hero/main.jpg"
        alt="Audi R8 gris mate en una carretera de montaña al atardecer"
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[70%_center]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-void via-void/70 to-void/10"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-void/80 via-void/30 to-transparent"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-48 bg-gradient-to-b from-void/80 to-transparent"
      />
      <div className="container-lux relative pb-10 pt-24 sm:pb-14 lg:pb-16">
        <div className="max-w-3xl">
          <p className="eyebrow">
            <Icon name="mapPin" size={14} />
            {LUXCARS_CONFIG.contact.city} · Miami
          </p>
          <h1
            id="hero-title"
            className="mt-4 text-balance text-[2.75rem] font-semibold leading-[1.02] tracking-tight text-ink sm:text-6xl lg:text-7xl"
          >
            Tu próximo auto premium,
            <span className="block text-silver">sin sorpresas.</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-ink-2 sm:text-lg">
            Cómpralo hoy de nuestro stock en Lima o lo importamos a pedido
            desde Estados Unidos. Inspeccionado, nacionalizado y con placas.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="/comprar" size="lg">
              Ver stock disponible
              <Icon name="arrowRight" size={18} />
            </Button>
            <Button href="/#calculator" variant="accent" size="lg">
              <Icon name="calculator" size={18} />
              Calcular importación
            </Button>
          </div>
        </div>

        {/* Selector de camino: tres accesos, una fila. */}
        <nav aria-label="Qué quieres hacer" className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PATHS.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group flex items-center gap-4 rounded-2xl border border-line/80 bg-void/60 p-4 backdrop-blur-md transition-colors hover:border-silver hover:bg-surface/80"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-silver-bright">
                <Icon name={p.icon} size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-ink">{p.label}</span>
                <span className="block text-sm text-ink-3">{p.hint}</span>
              </span>
              <Icon
                name="arrowRight"
                size={18}
                className="text-ink-4 transition-transform group-hover:translate-x-1 group-hover:text-ink"
              />
            </Link>
          ))}
        </nav>

        <ul className="mt-8 flex flex-wrap gap-x-7 gap-y-2 text-sm text-ink-3">
          {TRUST.map((t) => (
            <li key={t.text} className="inline-flex items-center gap-2">
              <Icon name={t.icon} size={16} className="text-silver" />
              {t.text}
            </li>
          ))}
          <li className="inline-flex items-center gap-2">
            <WhatsAppIcon size={16} className="text-whatsapp" />
            Respuesta el mismo día
          </li>
        </ul>
      </div>
    </section>
  );
}
