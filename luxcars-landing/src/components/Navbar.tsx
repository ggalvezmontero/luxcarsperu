"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { LUXCARS_CONFIG } from "@/lib/config";

const NAV_LINKS = [
  { label: "Inicio", href: "#hero" },
  { label: "Calculadora", href: "#calculator" },
  { label: "Marcas", href: "#brands" },
  { label: "Cómo Funciona", href: "#how-it-works" },
  { label: "Servicios", href: "#services" },
  { label: "Webs", href: "#websites" },
  { label: "FAQ", href: "#faq" },
  { label: "Contacto", href: "#contact" },
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
        "sticky top-0 z-50 w-full border-b border-white/5 backdrop-blur-xl transition",
        isScrolled
          ? "bg-black/80 shadow-[0_10px_40px_rgba(0,0,0,0.45)]"
          : "bg-black/30",
      )}
    >
      <nav
        data-navbar-root
        className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8 lg:px-0"
      >
        <Link
          href="#hero"
          onClick={handleLinkClick}
          className="flex items-center gap-3"
        >
          <span className="relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5">
            <Image
              src="/images/brands/lamborghini.png"
              alt="LuxCars insignia"
              width={44}
              height={44}
              className="h-full w-full object-cover"
              priority
            />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-lg font-semibold text-white">
              {LUXCARS_CONFIG.brandName}
            </span>
            <span className="text-[10px] uppercase tracking-[0.45em] text-white/50">
              Miami · Lima
            </span>
          </span>
        </Link>

        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:border-white/20 hover:bg-white/10 sm:hidden"
          aria-label="Abrir navegación"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
        >
          <span className="relative h-4 w-4">
            <span
              className={cn(
                "absolute inset-x-0 top-0 h-0.5 rounded-full bg-white transition",
                isMenuOpen ? "translate-y-1.5 rotate-45" : "",
              )}
            />
            <span
              className={cn(
                "absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-white transition",
                isMenuOpen ? "opacity-0" : "opacity-100",
              )}
            />
            <span
              className={cn(
                "absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white transition",
                isMenuOpen ? "-translate-y-1.5 -rotate-45" : "",
              )}
            />
          </span>
        </button>

        <div className="hidden items-center gap-8 text-sm font-medium uppercase tracking-[0.35em] text-white/70 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={handleLinkClick}
              className="group relative transition hover:text-white"
            >
              {link.label}
              <span className="absolute inset-x-0 -bottom-2 h-px scale-x-0 bg-gradient-to-r from-[#d4af37] via-[#f5d072] to-[#b68b2d] transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
        </div>

        <div className="hidden sm:flex">
          <Button href="#contact" size="md" className="shadow-lg">
            Cotizar ahora
          </Button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        className={cn(
          "sm:hidden",
          isMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="mx-4 mb-4 space-y-3 rounded-3xl border border-white/10 bg-black/80 px-6 py-4 text-sm uppercase tracking-[0.35em] text-white/70 transition-all">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={handleLinkClick}
              className="block rounded-2xl border border-transparent px-4 py-3 text-center transition hover:border-[#f5d072]/50 hover:bg-[#f5d072]/10 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
          <Button href="#contact" size="md" className="w-full">
            WhatsApp Concierge
          </Button>
        </div>
      </div>
    </header>
  );
}
