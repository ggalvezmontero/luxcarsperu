"use client";

import { LUXCARS_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "./Button";

/* Las tres líneas de negocio con página propia van primero: antes el menú
   solo ofrecía anclas de la home y la web entera parecía una importadora.
   El logo es el enlace a Inicio, así que no se repite como ítem.
   El menú hamburguesa sigue activo hasta lg (1024 px): por debajo de ese
   ancho esta fila no se muestra. */
const NAV_LINKS = [
  { label: "Comprar", href: "/comprar" },
  { label: "Importar", href: "/importar" },
  { label: "Vender", href: "/vender" },
  { label: "Calculadora", href: "/#calculator" },
  { label: "Cómo funciona", href: "/como-funciona" },
];

export function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  /* Solo se marca la ruta, nunca el ancla: el hash lo gobierna el scroll. */
  const isCurrent = (href: string) =>
    !href.includes("#") && href !== "/" && pathname === href;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 24);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[data-navbar-root]")) return;
      setIsMenuOpen(false);
    };

    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [isMenuOpen]);

  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-colors duration-300",
        isScrolled
          ? "border-line bg-bg/85 shadow-lg backdrop-blur-xl backdrop-saturate-150"
          : "border-transparent bg-bg/20 backdrop-blur-md",
      )}
    >
      <nav
        data-navbar-root
        className="flex w-full items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12"
      >
        <Link
          href="/"
          onClick={handleLinkClick}
          className="flex min-w-0 items-center gap-3"
        >
          <Image
            src="/brand/logo-blanco.svg"
            alt={LUXCARS_CONFIG.brandName}
            width={1010}
            height={590}
            className="h-11 w-auto shrink-0 sm:h-12 lg:h-14"
            priority
          />
          <span className="hidden text-[9px] uppercase tracking-[0.25em] text-ink-4 xl:inline">
            Miami · Lima
          </span>
        </Link>

        <div className="hidden flex-1 items-center justify-center whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.14em] text-ink-2 lg:flex lg:gap-5 xl:gap-7 xl:text-xs xl:tracking-[0.26em]">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={handleLinkClick}
              aria-current={isCurrent(link.href) ? "page" : undefined}
              className={cn(
                "group relative transition-colors duration-300 hover:text-ink",
                isCurrent(link.href) ? "text-ink" : "",
              )}
            >
              {link.label}
              <span
                className={cn(
                  "absolute inset-x-0 -bottom-2 h-px origin-left bg-silver transition-transform duration-300 group-hover:scale-x-100",
                  isCurrent(link.href) ? "scale-x-100" : "scale-x-0",
                )}
              />
            </Link>
          ))}
        </div>

        <div className="hidden lg:flex">
          <Button
            href="/#contact"
            size="md"
            className="!bg-silver !text-void !shadow-none hover:!bg-silver-bright"
          >
            Contáctenos
          </Button>
        </div>

        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink transition-colors duration-300 hover:border-silver hover:bg-surface-2 lg:hidden"
          aria-label={isMenuOpen ? "Cerrar navegación" : "Abrir navegación"}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
        >
          <span className="relative h-4 w-4">
            <span
              className={cn(
                "absolute inset-x-0 top-0 h-0.5 rounded-full bg-silver-bright transition-transform duration-300",
                isMenuOpen ? "translate-y-1.5 rotate-45" : "",
              )}
            />
            <span
              className={cn(
                "absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-silver-bright transition-opacity duration-300",
                isMenuOpen ? "opacity-0" : "opacity-100",
              )}
            />
            <span
              className={cn(
                "absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-silver-bright transition-transform duration-300",
                isMenuOpen ? "-translate-y-1.5 -rotate-45" : "",
              )}
            />
          </span>
        </button>
      </nav>

      <div
        id="mobile-menu"
        className={cn(
          "overflow-hidden transition-all duration-300 lg:hidden",
          isMenuOpen
            ? "max-h-[32rem] opacity-100 pointer-events-auto"
            : "max-h-0 opacity-0 pointer-events-none",
        )}
      >
        <div className="mx-4 mb-4 space-y-2 rounded-lux-xl border border-line bg-surface/95 px-3 py-4 text-xs uppercase tracking-[0.3em] text-ink-2 backdrop-blur-xl">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={handleLinkClick}
              aria-current={isCurrent(link.href) ? "page" : undefined}
              className={cn(
                "block rounded-lux border border-transparent px-4 py-3 text-center transition-colors duration-300 hover:border-line-strong hover:bg-surface-2 hover:text-ink",
                isCurrent(link.href) ? "border-line-strong bg-surface-2 text-ink" : "",
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="px-1 pt-1">
            <Button
              href="/#contact"
              size="md"
              className="w-full !bg-silver !text-void !shadow-none hover:!bg-silver-bright"
            >
              Contáctenos
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
