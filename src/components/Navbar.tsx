"use client";

import { LUXCARS_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Icon, WhatsAppIcon } from "./ui/Icon";

const NAV_LINKS = [
  { label: "Comprar", href: "/comprar" },
  { label: "Importar", href: "/importar" },
  { label: "Vender", href: "/vender" },
  { label: "Calculadora", href: "/#calculator" },
  { label: "Cómo funciona", href: "/como-funciona" },
];

const WA_HREF = `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}`;

export function Navbar() {
  const pathname = usePathname();
  /* Se guarda la ruta en la que se abrió: al navegar, `open` se vuelve falso
     solo, sin efectos ni setState al cambiar el pathname. */
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (next: boolean) => setOpenAt(next ? pathname : null);
  const [scrolled, setScrolled] = useState(false);

  const isCurrent = (href: string) =>
    !href.includes("#") && href !== "/" && pathname.startsWith(href);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Bloquear el scroll del fondo mientras el menú está abierto. */
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color] duration-300",
        scrolled || open ? "bg-void/90 backdrop-blur-xl" : "bg-transparent",
      )}
    >
      <nav
        aria-label="Principal"
        className="container-lux flex h-[var(--lux-nav-h)] items-center justify-between gap-6"
      >
        <Link href="/" className="flex shrink-0 items-center" aria-label="LuxCars Perú, inicio">
          <Image
            src="/brand/logo-blanco.svg"
            alt=""
            width={1010}
            height={590}
            priority
            className="h-12 w-auto sm:h-14"
          />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isCurrent(link.href) ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  isCurrent(link.href)
                    ? "bg-surface-2 text-ink"
                    : "text-ink-2 hover:bg-surface-2/70 hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <Button href={WA_HREF} variant="whatsapp" size="md">
              <WhatsAppIcon size={18} />
              WhatsApp
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface/60 text-ink transition-colors hover:border-line-strong lg:hidden"
          >
            <Icon name={open ? "close" : "menu"} size={20} />
          </button>
        </div>
      </nav>
    </header>

      {/* Menú móvil: va FUERA del header porque el backdrop-filter de la barra
          crea un bloque contenedor y recorta lo que se sale de ella. */}
      <div
        id="mobile-menu"
        inert={!open}
        className={cn(
          "fixed inset-x-0 bottom-0 top-[var(--lux-nav-h)] z-40 flex flex-col overflow-y-auto bg-void/95 backdrop-blur-xl transition-opacity duration-200 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <ul className="container-lux flex flex-col gap-1 pt-6">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={isCurrent(link.href) ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between rounded-2xl px-4 py-4 text-lg font-medium transition-colors",
                  isCurrent(link.href) ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2",
                )}
              >
                {link.label}
                <Icon name="chevronRight" size={18} className="text-ink-4" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="container-lux mt-auto flex flex-col gap-3 border-t border-line py-6">
          <Button href={WA_HREF} variant="whatsapp" size="lg" className="w-full">
            <WhatsAppIcon size={20} />
            Escribir por WhatsApp
          </Button>
          <p className="text-center text-xs text-ink-4">
            {LUXCARS_CONFIG.contact.address}
          </p>
        </div>
      </div>
    </>
  );
}
