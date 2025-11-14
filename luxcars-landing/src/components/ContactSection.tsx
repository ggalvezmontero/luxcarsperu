'use client';

import { useEffect, useState } from "react";
import { Button } from "./Button";
import { SectionHeading } from "./SectionHeading";
import { LUXCARS_CONFIG } from "@/lib/config";
import { buildWhatsappLink } from "@/lib/whatsapp";
import type { PremiumImportQuote } from "@/core/pricing/priceCalculator";
import { cn, formatCurrency, formatPercentage } from "@/lib/utils";
import Image from "next/image";

type FormState = {
  name: string;
  phone: string;
  email: string;
  notes: string;
  preferredPlan: "fast" | "standard";
};

const INITIAL_FORM: FormState = {
  name: "",
  phone: "",
  email: "",
  notes: "",
  preferredPlan: "fast",
};

type StoredPayload = {
  estimate: PremiumImportQuote;
  preferredPlan: "fast" | "standard";
};

const STORAGE_KEY = "luxcars:last-estimate";

export function ContactSection() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [latestEstimate, setLatestEstimate] =
    useState<PremiumImportQuote | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    function loadFromStorage() {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        const parsed: StoredPayload = JSON.parse(stored);
        if (parsed?.estimate) {
          setLatestEstimate(parsed.estimate);
          setForm((prev) => ({
            ...prev,
            preferredPlan: parsed.preferredPlan ?? "fast",
          }));
        }
      } catch (err) {
        console.warn("No se pudo leer el estimado almacenado", err);
      }
    }

    loadFromStorage();

    function handleCustomEvent(event: Event) {
      const custom = event as CustomEvent<StoredPayload>;
      if (custom?.detail?.estimate) {
        setLatestEstimate(custom.detail.estimate);
        setForm((prev) => ({
          ...prev,
          preferredPlan: custom.detail.preferredPlan ?? prev.preferredPlan,
        }));
      }
    }

    window.addEventListener(STORAGE_KEY, handleCustomEvent);
    return () => window.removeEventListener(STORAGE_KEY, handleCustomEvent);
  }, []);

  useEffect(() => {
    if (!latestEstimate) return;
    setFeedback(
        `Último cálculo cargado: ${latestEstimate.input.brand} ${latestEstimate.input.model} ${latestEstimate.input.year} · ${latestEstimate.vehicleCategory.label} (ISC ${formatPercentage(latestEstimate.iscRate)}) — ${formatCurrency(latestEstimate.finalEstimate)}`,
    );
  }, [latestEstimate]);

  const handleChange =
    (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handlePlanChange = (plan: "fast" | "standard") => {
    setForm((prev) => ({ ...prev, preferredPlan: plan }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFeedback(null);

    if (!latestEstimate) {
      setError("Primero genera tu cálculo en la sección superior para enviar los datos completos.");
      return;
    }

    if (!form.name || !form.phone) {
      setError("Completa al menos tu nombre y un teléfono de contacto.");
      return;
    }

    setIsSending(true);
    try {
      const link = buildWhatsappLink(latestEstimate, {
        name: form.name,
        phone: form.phone,
        email: form.email,
        notes: form.notes,
        preferredPlan: form.preferredPlan,
      });
      setFeedback(
        "Perfecto. Abre WhatsApp para coordinar con nuestro concierge. Recibirás confirmación inmediata.",
      );
      window.open(link, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      setError(
        "No pudimos generar el enlace de WhatsApp. Actualiza la página e inténtalo nuevamente.",
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section
      id="contact"
      className="scroll-mt-32 rounded-[40px] border border-white/10 bg-gradient-to-br from-neutral-950 via-black to-neutral-900 px-6 py-20 lg:px-14"
    >
      <SectionHeading
        eyebrow="Contacto premium"
        title="Listo para importar tu siguiente auto de lujo"
        description="Déjanos tus datos y llévate una asesoría personalizada basada en tu cálculo real. Abriremos WhatsApp con toda la información precargada."
      />
      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <form
          onSubmit={handleSubmit}
          className="grid gap-5 rounded-[28px] border border-white/10 bg-white/[0.05] p-8 shadow-[0_25px_100px_rgba(0,0,0,0.35)]"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-white/70">
              Nombre completo
              <input
                value={form.name}
                onChange={handleChange("name")}
                placeholder="Ej. Diego Salazar"
                className="h-12 rounded-2xl border border-white/10 bg-black/60 px-4 text-white shadow-inner shadow-black/40 placeholder:text-white/30 focus:border-[#f5d072] focus:outline-none focus:ring-2 focus:ring-[#f5d072]/30"
              />
            </label>
            <label className="grid gap-2 text-sm text-white/70">
              Teléfono / WhatsApp
              <input
                value={form.phone}
                onChange={handleChange("phone")}
                placeholder="+51 999 999 999"
                className="h-12 rounded-2xl border border-white/10 bg-black/60 px-4 text-white shadow-inner shadow-black/40 placeholder:text-white/30 focus:border-[#f5d072] focus:outline-none focus:ring-2 focus:ring-[#f5d072]/30"
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm text-white/70">
            Email (opcional)
            <input
              value={form.email}
              onChange={handleChange("email")}
              placeholder="Ej. concierge@luxcars.pe"
              className="h-12 rounded-2xl border border-white/10 bg-black/60 px-4 text-white shadow-inner shadow-black/40 placeholder:text-white/30 focus:border-[#f5d072] focus:outline-none focus:ring-2 focus:ring-[#f5d072]/30"
            />
          </label>
          <label className="grid gap-2 text-sm text-white/70">
            Notas adicionales
            <textarea
              value={form.notes}
              onChange={handleChange("notes")}
              rows={4}
              placeholder="¿Quieres blindaje, upgrades de performance o detalles específicos?"
              className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white shadow-inner shadow-black/40 placeholder:text-white/30 focus:border-[#f5d072] focus:outline-none focus:ring-2 focus:ring-[#f5d072]/30"
            />
          </label>
          <div className="grid gap-2 text-sm text-white/70">
            Plan preferido
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                {
                  key: "fast",
                  label: LUXCARS_CONFIG.deliveryWindows.fastTrack.label,
                  days: LUXCARS_CONFIG.deliveryWindows.fastTrack.days,
                },
                {
                  key: "standard",
                  label: LUXCARS_CONFIG.deliveryWindows.standard.label,
                  days: LUXCARS_CONFIG.deliveryWindows.standard.days,
                },
              ] as const).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handlePlanChange(option.key)}
                  className={cn(
                    "rounded-2xl border px-5 py-4 text-left transition",
                    form.preferredPlan === option.key
                      ? "border-[#f5d072]/80 bg-[#f5d072]/10 text-white"
                      : "border-white/10 bg-black/50 text-white/60 hover:border-white/20 hover:text-white",
                  )}
                >
                  <span className="text-xs uppercase tracking-[0.3em] text-white/50">
                    {option.label}
                  </span>
                  <p className="mt-2 text-lg font-medium text-white">
                    {option.days[0]} - {option.days[1]} días
                  </p>
                </button>
              ))}
            </div>
          </div>
          {error ? (
            <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-5 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {feedback ? (
            <div className="rounded-2xl border border-[#f5d072]/30 bg-[#f5d072]/10 px-5 py-3 text-sm text-[#fbe5a4]">
              {feedback}
            </div>
          ) : null}
          <Button type="submit" size="lg" disabled={isSending}>
            {isSending ? "Abriendo WhatsApp..." : "Enviar ahora por WhatsApp"}
          </Button>
            <p className="text-xs text-white/40">
              Al enviar, abriremos WhatsApp con toda la información precargada
              para que converses con nuestro concierge inmediatamente.
            </p>
          </form>
          <div className="space-y-6 rounded-[28px] border border-white/10 bg-white/[0.05] p-8 text-sm text-white/70 shadow-[0_25px_100px_rgba(0,0,0,0.35)]">
            <div className="relative h-44 overflow-hidden rounded-2xl border border-white/10">
              <Image
                src="/images/contact/concierge.jpg"
                alt="Concierge LuxCars coordinando importación"
                fill
                sizes="(min-width: 1024px) 320px, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <span className="absolute left-4 top-4 inline-flex items-center rounded-full border border-[#f5d072]/30 bg-[#f5d072]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-[#fbe5a4]">
                Concierge
              </span>
            </div>
            <h3 className="text-2xl font-semibold text-white">
              Concierge dedicado en Miami & Lima
            </h3>
            <p>
              Tu consultor personal te envía fotos, videos, contratos y cualquier
              documentación que necesites. Reporte cada 48 horas durante el tránsito
              marítimo.
            </p>
            <div className="rounded-3xl border border-white/10 bg-black/70 p-6 text-white/80">
              <h4 className="text-lg font-semibold text-white">
                ¿Qué incluye tu primera llamada?
              </h4>
              <ul className="mt-4 space-y-3 text-sm">
                <li>• Revisión del estimado y ajustes según versión o upgrades.</li>
                <li>• Curaduría de inventario real en tiempo real.</li>
                <li>• Estrategia de negociación y verificación de historial.</li>
                <li>• Agenda de próximos pasos y documentación requerida.</li>
              </ul>
            </div>
            <div className="rounded-3xl border border-[#f5d072]/30 bg-[#f5d072]/10 p-6 text-sm text-[#fbe5a4]">
              <p>
                WhatsApp oficial:{" "}
                <span className="font-semibold">
                  +{LUXCARS_CONFIG.contact.whatsappNumber}
                </span>
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.3em]">
                LuxCars.pe · Importación premium
              </p>
            </div>
          </div>
        </div>
      </section>
    );
}
