'use client';

import { useEffect, useState } from "react";
import Link from "next/link";

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
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 backdrop-blur-md animate-in slide-in-from-bottom duration-500"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-6 sm:py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-silver">
            Utilizamos cookies
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            Utilizamos cookies esenciales para el funcionamiento del sitio y cookies opcionales para mejorar tu experiencia y analizar el uso.{" "}
            <Link
              href="/cookies"
              className="text-ink-2 underline underline-offset-2 transition-colors hover:text-silver-bright"
            >
              Más información
            </Link>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            onClick={handleReject}
            className="flex-1 whitespace-nowrap rounded-full border border-line-strong px-5 py-2 text-xs font-medium uppercase tracking-[0.12em] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink sm:flex-none"
          >
            Rechazar
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 whitespace-nowrap rounded-full border border-silver-bright bg-silver-bright px-5 py-2 text-xs font-medium uppercase tracking-[0.12em] text-void transition-colors hover:bg-silver hover:border-silver sm:flex-none"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
