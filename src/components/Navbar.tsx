"use client";

import { LUXCARS_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "./Button";

const NAV_LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Más buscados", href: "/#mas-buscados" },
  { label: "Calculadora", href: "/#calculator" },
  { label: "Etapas", href: "/#timeline" },
  { label: "Cómo Funciona", href: "/como-funciona" },
];

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

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
            src="/brand/luxcars-blanco.svg"
            alt={LUXCARS_CONFIG.brandName}
            width={1254}
            height={1254}
            className="h-9 w-auto shrink-0 sm:h-10 lg:h-11"
            priority
          />
          <span className="hidden text-[10px] uppercase tracking-[0.4em] text-ink-4 sm:inline">
            Miami · Lima
          </span>
        </Link>

        <div className="hidden flex-1 items-center justify-center gap-5 text-xs font-medium uppercase tracking-[0.2em] text-ink-2 lg:flex lg:gap-7 lg:tracking-[0.3em]">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={handleLinkClick}
              className="group relative transition-colors duration-300 hover:text-ink"
            >
              {link.label}
              <span className="absolute inset-x-0 -bottom-2 h-px origin-left scale-x-0 bg-silver transition-transform duration-300 group-hover:scale-x-100" />
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
            ? "max-h-96 opacity-100 pointer-events-auto"
            : "max-h-0 opacity-0 pointer-events-none",
        )}
      >
        <div className="mx-4 mb-4 space-y-2 rounded-lux-xl border border-line bg-surface/95 px-3 py-4 text-xs uppercase tracking-[0.3em] text-ink-2 backdrop-blur-xl">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={handleLinkClick}
              className="block rounded-lux border border-transparent px-4 py-3 text-center transition-colors duration-300 hover:border-line-strong hover:bg-surface-2 hover:text-ink"
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
