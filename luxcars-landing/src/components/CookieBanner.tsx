'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "./Button";

const COOKIE_CONSENT_KEY = "luxcars-cookie-consent";

export function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Show banner after a short delay for better UX
      setTimeout(() => setShowBanner(true), 1000);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setShowBanner(false);
    // Here you would initialize analytics and other tracking
    console.log("Cookies accepted");
  };

  const handleReject = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "rejected");
    setShowBanner(false);
    console.log("Cookies rejected");
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 animate-in slide-in-from-bottom duration-500">
      <div className="mx-auto max-w-6xl rounded-3xl border border-white/20 bg-gradient-to-br from-neutral-950 via-black to-neutral-900 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 space-y-2">
            <h3 className="text-lg font-semibold text-white">
              🍪 Utilizamos Cookies
            </h3>
            <p className="text-sm text-white/70 leading-relaxed">
              Utilizamos cookies esenciales para el funcionamiento del sitio y cookies opcionales para mejorar tu experiencia y analizar el uso.{" "}
              <Link
                href="/cookies"
                className="text-white underline underline-offset-2 hover:text-white/80 transition"
              >
                Más información
              </Link>
            </p>
          </div>
          
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-none">
            <button
              onClick={handleReject}
              className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium uppercase tracking-[0.08em] text-white transition-all hover:bg-white/20 hover:border-white/40 whitespace-nowrap"
            >
              Rechazar
            </button>
            <Button
              onClick={handleAccept}
              size="md"
              className="!text-black whitespace-nowrap"
            >
              Aceptar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

