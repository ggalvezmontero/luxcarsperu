'use client';

import type { PremiumImportQuote } from "@/core/pricing/priceCalculator";
import { LUXCARS_CONFIG } from "@/lib/config";
import { cn, formatCurrency, formatPercentage } from "@/lib/utils";
import { buildWhatsappLink } from "@/lib/whatsapp";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { PlaceholderGrafico } from "./PlaceholderGrafico";
import { SectionHeading } from "./SectionHeading";

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

/* SIN `focus:outline-none`. Lo tenía, y lo único que quedaba como indicador de
   foco era el cambio de color de un borde de 1 px (`focus:border-silver-bright`):
   no llega al indicador de foco visible que exige WCAG 2.4.7 y desaparecía por
   completo en modo de alto contraste. El anillo de foco global de globals.css
   vuelve a aplicarse; el cambio de borde se conserva como refuerzo visual. */
const fieldClasses =
  "w-full rounded-lux border border-line-strong bg-surface-3 text-ink transition-colors duration-200 placeholder:text-ink-3 hover:border-silver-dim focus:border-silver-bright";

export function ContactSection() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [latestEstimate, setLatestEstimate] =
    useState<PremiumImportQuote | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  /* Para llevar el foco AL CAMPO que falta cuando la validación falla. Con
     `role="alert"` el mensaje se anuncia, pero el foco se queda en el botón
     "Enviar", al final del formulario: había que retroceder a ciegas hasta
     encontrar el campo vacío. WCAG 3.3.1 pide identificar el error; llevar el
     foco es lo que lo hace accionable. */
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

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
      (form.name ? phoneRef : nameRef).current?.focus();
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
      className="scroll-mt-32 overflow-hidden rounded-lux-lg md:rounded-lux-xl border border-line bg-gradient-to-br from-void via-bg to-surface px-4 py-12 md:px-6 md:py-20 lg:px-14"
    >
      <SectionHeading
        eyebrow="Contacto premium"
        title="Listo para importar tu siguiente auto de lujo"
        description="Déjanos tus datos y llévate una asesoría personalizada basada en tu cálculo real. Abriremos WhatsApp con toda la información precargada."
      />
      <div className="mt-8 md:mt-12 grid gap-6 md:gap-10 lg:grid-cols-2">
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 md:gap-5 rounded-lux-lg border border-line bg-surface p-5 md:p-8 shadow-[var(--lux-shadow-lg)]"
        >
          <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-ink-2">
              Nombre completo
              <input
                ref={nameRef}
                value={form.name}
                onChange={handleChange("name")}
                placeholder="Ej. Diego Salazar"
                /* `autoComplete` no es cosmético: WCAG 1.3.5 (Identify Input
                   Purpose) pide declarar el propósito de los campos que piden
                   datos del propio usuario, para que las ayudas de
                   autocompletado y los lectores de pantalla los rellenen. */
                autoComplete="name"
                aria-required="true"
                aria-invalid={Boolean(error) && !form.name}
                className={cn(fieldClasses, "h-11 md:h-12 px-3 md:px-4 text-base")}
                style={{
                  fontSize: '16px', // Prevenir zoom automático en móviles
                }}
              />
            </label>
            <label className="grid gap-2 text-sm text-ink-2">
              Teléfono / WhatsApp
              <input
                ref={phoneRef}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                aria-required="true"
                aria-invalid={Boolean(error) && !form.phone}
                value={form.phone}
                onChange={handleChange("phone")}
                placeholder="+51 999 999 999"
                className={cn(fieldClasses, "h-11 md:h-12 px-3 md:px-4 text-base")}
                style={{
                  fontSize: '16px', // Prevenir zoom automático en móviles
                }}
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm text-ink-2">
            Email (opcional)
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange("email")}
              placeholder="Ej. concierge@luxcars.pe"
              className={cn(fieldClasses, "h-11 md:h-12 px-3 md:px-4 text-base")}
              style={{
                fontSize: '16px', // Prevenir zoom automático en móviles
              }}
            />
          </label>
          <label className="grid gap-2 text-sm text-ink-2">
            Notas adicionales
            <textarea
              value={form.notes}
              onChange={handleChange("notes")}
              rows={3}
              placeholder="¿Quieres blindaje, upgrades o detalles específicos?"
              className={cn(fieldClasses, "px-3 md:px-4 py-2.5 md:py-3 text-base")}
              style={{
                fontSize: '16px', // Prevenir zoom automático en móviles
              }}
            />
          </label>
          {/* "Plan preferido" era texto suelto dentro de un <div>: se veía como
              etiqueta pero no lo era para nadie más. Quien navega con lector de
              pantalla oía dos botones de alternancia sin saber de qué grupo son
              ni qué eligen. `role="group"` + `aria-labelledby` lo convierte en
              un grupo con nombre de verdad (WCAG 1.3.1). */}
          <div className="grid gap-2 text-sm text-ink-2">
            <span id="contacto-plan-etiqueta">Plan preferido</span>
            <div
              role="group"
              aria-labelledby="contacto-plan-etiqueta"
              className="grid gap-2.5 md:gap-3 sm:grid-cols-2"
            >
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
                  aria-pressed={form.preferredPlan === option.key}
                  onClick={() => handlePlanChange(option.key)}
                  className={cn(
                    "rounded-lux border px-4 md:px-5 py-3 md:py-4 text-left transition-colors duration-200",
                    form.preferredPlan === option.key
                      ? "border-silver bg-surface-3 text-ink"
                      : "border-line-strong bg-bg text-ink-3 hover:border-silver-dim hover:text-ink",
                  )}
                >
                  <span className="block text-[11px] uppercase tracking-[0.25em] text-ink-3">
                    {option.label}
                  </span>
                  <p className="mt-1.5 md:mt-2 text-base md:text-lg font-medium text-ink">
                    {option.days[0]} - {option.days[1]} días
                  </p>
                </button>
              ))}
            </div>
          </div>
          {error ? (
            <div
              role="alert"
              className="rounded-lux border border-danger/40 bg-danger/10 px-4 md:px-5 py-2.5 md:py-3 text-sm text-danger"
            >
              {error}
            </div>
          ) : null}
          {feedback ? (
            <div
              role="status"
              className="rounded-lux border border-silver/30 bg-silver/10 px-4 md:px-5 py-2.5 md:py-3 text-sm text-silver-bright"
            >
              {feedback}
            </div>
          ) : null}
          {/* Único CTA en oro de la sección: el resto del acento es plata. */}
          <Button type="submit" variant="accent" size="lg" disabled={isSending}>
            {isSending ? "Abriendo WhatsApp..." : "Enviar ahora"}
          </Button>
          <p className="text-xs text-ink-4">
            Al enviar, abriremos WhatsApp con toda la información precargada
            para que converses con nuestro concierge inmediatamente.
          </p>
        </form>
        <div className="space-y-4 md:space-y-6 rounded-lux-lg border border-line bg-surface p-5 md:p-8 text-sm text-ink-2 shadow-[var(--lux-shadow-lg)]">
          {/* Aquí había /images/contact/concierge.jpg con el alt "Concierge de
              LuxCars coordinando una importación desde Miami". La foto era
              stock: dos oficinistas desconocidos chocando las manos, sin auto y
              sin relación con LuxCars. Presentar stock como "nuestro equipo"
              miente sobre quién atiende al cliente. Va tratamiento gráfico
              hasta tener la foto real del equipo (docs/IMAGENES.md). */}
          <div className="relative h-36 overflow-hidden rounded-lux border border-line md:h-44">
            <PlaceholderGrafico
              titulo="Concierge"
              nota="Pendiente: retrato real del equipo que atiende Miami y Lima."
              icono="asesor"
              className="h-full w-full border-0"
            />
          </div>
          <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-ink">
            Concierge dedicado en Miami &amp; Lima
          </h3>
          <p className="text-sm leading-relaxed text-ink-2">
            Tu consultor personal te envía fotos, videos, contratos y cualquier
            documentación que necesites. Reporte cada 48 horas durante el tránsito
            marítimo.
          </p>
          <div className="rounded-lux border border-line bg-bg p-4 md:p-6 text-ink-2">
            <h4 className="text-base md:text-lg font-semibold text-ink">
              ¿Qué incluye tu primera llamada?
            </h4>
            <ul className="mt-3 md:mt-4 space-y-2 md:space-y-3 text-sm">
              <li>• Revisión del estimado y ajustes según versión o upgrades.</li>
              <li>• Curaduría de inventario real en tiempo real.</li>
              <li>• Estrategia de negociación y verificación de historial.</li>
              <li>• Agenda de próximos pasos y documentación requerida.</li>
            </ul>
          </div>
          <div className="rounded-lux border border-line-strong bg-void p-4 md:p-6 text-sm text-ink-2">
            <p>
              <span className="block text-[11px] uppercase tracking-[0.3em] text-silver">
                WhatsApp oficial:
              </span>
              <span className="mt-1 block text-base font-semibold tracking-wide text-ink break-words">
                +{LUXCARS_CONFIG.contact.whatsappNumber}
              </span>
            </p>
            <div className="my-4 h-px w-full bg-line" />
            <p>
              <span className="block text-[11px] uppercase tracking-[0.3em] text-silver">
                Oficina para reuniones presenciales:
              </span>
              <span className="mt-1 block leading-relaxed text-ink">
                {LUXCARS_CONFIG.contact.address}
              </span>
              <span className="mt-2 block text-xs italic text-ink-4">
                Con cita previa
              </span>
            </p>
            <p className="mt-5 text-[11px] uppercase tracking-[0.3em] text-ink-3">
              LuxCars.pe · Importación premium
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
