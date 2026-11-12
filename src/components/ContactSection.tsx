"use client";

import type { PremiumImportQuote } from "@/core/pricing/priceCalculator";
import { LUXCARS_CONFIG } from "@/lib/config";
import { formatCurrency } from "@/lib/utils";
import { buildWhatsappLink } from "@/lib/whatsapp";
import { GA_EVENTS, trackEvent } from "@/lib/analytics";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { Icon, WhatsAppIcon } from "./ui/Icon";
import { Section, SectionHeader } from "./ui/Section";
import { PhoneInput } from "@/components/PhoneInput";
import { errorDeTelefono, telefonoValido } from "@/lib/telefono";

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
  /** Cuándo se calculó, en milisegundos. */
  timestamp: number;
  preferredPlan: "fast" | "standard";
};

const STORAGE_KEY = "luxcars:last-estimate";
const PHONE_FIELD_ID = "contact-phone";
const { contact } = LUXCARS_CONFIG;

/** Un estimado guardado se adjunta al contacto solo durante este tiempo. */
const ESTIMATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * ¿El estimado guardado sirve para adjuntarlo? Tiene que ser reciente y traer
 * los campos que el mensaje de WhatsApp imprime: uno guardado por una versión
 * anterior del sitio, sin ellos, saldría como "USD NaN".
 */
function isUsableEstimate(payload: StoredPayload | null): payload is StoredPayload {
  const estimate = payload?.estimate;
  if (!payload || !estimate) return false;
  if (!(Date.now() - payload.timestamp < ESTIMATE_MAX_AGE_MS)) return false;
  return [estimate.finalEstimate, estimate.cashRequired, estimate.percepcionRate, estimate.ipm].every(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
}

/** Enlace genérico cuando no hay un cálculo previo que adjuntar. */
function buildPlainWhatsapp(form: FormState) {
  const lines = [
    `Hola Luxcars, soy ${form.name.trim()}.`,
    form.notes.trim() ? form.notes.trim() : "Quiero información sobre sus servicios.",
    `Teléfono: ${form.phone.trim()}`,
    form.email.trim() ? `Correo: ${form.email.trim()}` : undefined,
  ].filter(Boolean);
  return `https://wa.me/${contact.whatsappNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
}

export function ContactSection() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [latestEstimate, setLatestEstimate] = useState<PremiumImportQuote | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = () => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        const parsed: StoredPayload = JSON.parse(stored);
        if (isUsableEstimate(parsed)) {
          setLatestEstimate(parsed.estimate);
          setForm((prev) => ({ ...prev, preferredPlan: parsed.preferredPlan ?? "fast" }));
        } else {
          // Viejo o de un formato anterior: no se adjunta ni se conserva.
          window.localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        /* sin cálculo previo */
      }
    };
    load();
    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<StoredPayload | null>).detail;
      // La calculadora avisa con `null` cuando el estimado dejó de valer
      // (datos incompletos, auto que no entra, reinicio): se deja de adjuntar.
      if (!detail?.estimate) {
        setLatestEstimate(null);
        return;
      }
      setLatestEstimate(detail.estimate);
      setForm((prev) => ({
        ...prev,
        preferredPlan: detail.preferredPlan ?? prev.preferredPlan,
      }));
    };
    window.addEventListener(STORAGE_KEY, onEvent);
    return () => window.removeEventListener(STORAGE_KEY, onEvent);
  }, []);

  const handleChange =
    (field: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFeedback(null);

    if (!form.name.trim()) {
      setError("Completa tu nombre y un teléfono de contacto.");
      nameRef.current?.focus();
      return;
    }
    const errorTelefono = errorDeTelefono(form.phone);
    if (errorTelefono) {
      setError(errorTelefono);
      document.getElementById(PHONE_FIELD_ID)?.focus();
      return;
    }

    try {
      const link = latestEstimate
        ? buildWhatsappLink(latestEstimate, {
            name: form.name,
            phone: form.phone,
            email: form.email,
            notes: form.notes,
            preferredPlan: form.preferredPlan,
          })
        : buildPlainWhatsapp(form);
      setFeedback("Abrimos WhatsApp con tu mensaje listo. Tú decides si lo envías.");
      trackEvent(GA_EVENTS.contactFormSubmit, {
        with_estimate: Boolean(latestEstimate),
        preferred_plan: form.preferredPlan,
        with_email: Boolean(form.email.trim()),
      });
      window.open(link, "_blank", "noopener,noreferrer");
    } catch {
      setError("No pudimos abrir WhatsApp. Escríbenos directamente al número de abajo.");
    }
  };

  return (
    <Section id="contact" tone="bg">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeader
            eyebrow="Contacto"
            title="Hablemos de tu próximo auto"
            description="Te respondemos el mismo día por WhatsApp. Sin compromiso."
          />
          <ul className="mt-8 space-y-3">
            <li>
              <a
                href={`https://wa.me/${contact.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                data-ga-cta="contacto_whatsapp_directo"
                className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-whatsapp/15 text-whatsapp">
                  <WhatsAppIcon size={22} />
                </span>
                <span>
                  <span className="block text-sm text-ink-3">WhatsApp</span>
                  <span className="block font-semibold text-ink">{contact.phone}</span>
                </span>
              </a>
            </li>
            <li>
              <a
                href={`mailto:${contact.email}`}
                data-ga-cta="contacto_correo"
                className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-silver-bright">
                  <Icon name="mail" size={22} />
                </span>
                <span>
                  <span className="block text-sm text-ink-3">Correo</span>
                  <span className="block font-semibold text-ink">{contact.email}</span>
                </span>
              </a>
            </li>
            <li className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-silver-bright">
                <Icon name="mapPin" size={22} />
              </span>
              <span>
                <span className="block text-sm text-ink-3">Oficina</span>
                <span className="block font-semibold text-ink">{contact.address}</span>
              </span>
            </li>
          </ul>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-[22px] border border-line bg-surface p-6 sm:p-8 lg:col-span-7"
        >
          {latestEstimate ? (
            <p className="mb-6 flex items-start gap-3 rounded-2xl border border-line-strong bg-surface-2 px-4 py-3 text-sm text-ink-2">
              <Icon name="calculator" size={18} className="mt-0.5 shrink-0 text-silver-bright" />
              <span>
                Adjuntaremos tu cálculo: {latestEstimate.input.brand}{" "}
                {latestEstimate.input.model} {latestEstimate.input.year} ·{" "}
                <strong className="text-ink">{formatCurrency(latestEstimate.finalEstimate)}</strong>
              </span>
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-ink-2">
              Nombre
              <input
                ref={nameRef}
                value={form.name}
                onChange={handleChange("name")}
                placeholder="Tu nombre"
                autoComplete="name"
                aria-required="true"
                aria-invalid={Boolean(error) && !form.name}
                className="field-lux"
              />
            </label>
            {/* `div` y no `label` envolvente: el campo tiene dos controles (país
                y número) y la etiqueta debe apuntar al número. */}
            <div className="grid gap-1.5 text-sm font-medium text-ink-2">
              <label htmlFor={PHONE_FIELD_ID}>WhatsApp</label>
              <PhoneInput
                id={PHONE_FIELD_ID}
                required
                invalid={Boolean(error) && !telefonoValido(form.phone)}
                value={form.phone}
                onChange={(phone) => setForm((prev) => ({ ...prev, phone }))}
              />
            </div>
          </div>
          <label className="mt-4 grid gap-1.5 text-sm font-medium text-ink-2">
            Correo <span className="font-normal text-ink-4">(opcional)</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange("email")}
              placeholder="tu@correo.com"
              className="field-lux"
            />
          </label>
          <label className="mt-4 grid gap-1.5 text-sm font-medium text-ink-2">
            ¿En qué te ayudamos?
            <textarea
              value={form.notes}
              onChange={handleChange("notes")}
              rows={3}
              placeholder="Ej. Quiero un Porsche Macan 2024, presupuesto USD 80,000."
              className="field-lux min-h-[6.5rem] resize-y"
            />
          </label>

          {error ? (
            <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-danger">
              <Icon name="alert" size={16} />
              {error}
            </p>
          ) : null}
          {feedback ? (
            <p role="status" className="mt-4 flex items-center gap-2 text-sm text-ok">
              <Icon name="check" size={16} />
              {feedback}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="submit" variant="whatsapp" size="lg">
              <WhatsAppIcon size={20} />
              Enviar por WhatsApp
            </Button>
            <p className="text-xs text-ink-4">
              No guardamos tus datos. Se abre WhatsApp con el mensaje listo.
            </p>
          </div>
        </form>
      </div>
    </Section>
  );
}
