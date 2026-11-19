"use client";

import { useState } from "react";

import { Button } from "@/components/Button";
import { PhoneInput } from "@/components/PhoneInput";
import { Icon } from "@/components/ui/Icon";
import { LUXCARS_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";

type Tipo = "reclamo" | "queja";
type Bien = "producto" | "servicio";

type Estado =
  | { fase: "editando" }
  | { fase: "enviando" }
  | { fase: "error"; mensaje: string }
  | { fase: "registrada"; numero: string; fecha: string };

const inicial = {
  tipo: "reclamo" as Tipo,
  nombre: "",
  documento: "",
  domicilio: "",
  telefono: "",
  email: "",
  menorDeEdad: false,
  apoderado: "",
  bienTipo: "servicio" as Bien,
  bienDescripcion: "",
  montoUsd: "",
  detalle: "",
  pedido: "",
  acepta: false,
  empresa: "", // trampa para bots, no se muestra
};

const fechaLarga = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeStyle: "short", timeZone: "America/Lima" }).format(new Date(iso));

/**
 * La hoja oficial en cuatro bloques: quién reclama, qué contrató, qué pasó y
 * qué pide. Al registrarla, la pantalla se convierte en la copia para el
 * consumidor (número, fecha y contenido) con botón de imprimir.
 */
export function FormularioReclamacion() {
  const [f, setF] = useState(inicial);
  const [estado, setEstado] = useState<Estado>({ fase: "editando" });
  const set = <K extends keyof typeof inicial>(k: K, v: (typeof inicial)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado({ fase: "enviando" });
    try {
      const r = await fetch("/api/reclamaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const json = (await r.json().catch(() => null)) as { ok?: boolean; mensaje?: string; numero?: string; fecha?: string } | null;
      if (r.ok && json?.ok && json.numero && json.fecha) {
        setEstado({ fase: "registrada", numero: json.numero, fecha: json.fecha });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setEstado({ fase: "error", mensaje: json?.mensaje ?? "No se pudo registrar la hoja. Inténtalo de nuevo." });
      }
    } catch {
      setEstado({ fase: "error", mensaje: "Sin conexión. Revisa tu internet e inténtalo de nuevo." });
    }
  }

  if (estado.fase === "registrada") {
    return (
      <section aria-live="polite" className="space-y-6 rounded-[22px] border border-ok/30 bg-surface p-6 sm:p-8 print:border-black">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ok">Hoja registrada</p>
            <h2 className="mt-2 text-2xl font-semibold tabular-nums text-ink">{estado.numero}</h2>
            <p className="mt-1 text-sm text-ink-3">{fechaLarga(estado.fecha)}</p>
          </div>
          <Button onClick={() => window.print()} variant="secondary" size="sm" className="print:hidden">
            <Icon name="download" size={14} />
            Imprimir o guardar PDF
          </Button>
        </div>
        <p className="text-sm leading-relaxed text-ink-2">
          Guarda este número. Te responderemos
          {f.email ? ` al correo ${f.email}` : ""}
          {f.email && f.telefono ? " o" : ""}
          {f.telefono ? ` al ${f.telefono}` : ""} en un plazo máximo de quince (15) días hábiles.
        </p>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Dato k="Tipo" v={f.tipo === "reclamo" ? "Reclamo" : "Queja"} />
          <Dato k="Consumidor" v={f.nombre} />
          <Dato k="Documento" v={f.documento} />
          <Dato k="Domicilio" v={f.domicilio} />
          {f.menorDeEdad && f.apoderado ? <Dato k="Padre, madre o apoderado" v={f.apoderado} /> : null}
          <Dato k={f.bienTipo === "producto" ? "Producto" : "Servicio"} v={f.bienDescripcion} />
          {f.montoUsd ? <Dato k="Monto reclamado" v={`USD ${f.montoUsd}`} /> : null}
          <div className="sm:col-span-2">
            <Dato k="Detalle" v={f.detalle} />
          </div>
          <div className="sm:col-span-2">
            <Dato k="Pedido" v={f.pedido} />
          </div>
        </dl>
        <p className="text-xs text-ink-4">
          {LUXCARS_CONFIG.legalName} · RUC {LUXCARS_CONFIG.ruc} · {LUXCARS_CONFIG.contact.address}, {LUXCARS_CONFIG.contact.city}
        </p>
      </section>
    );
  }

  const ocupado = estado.fase === "enviando";

  return (
    <form onSubmit={enviar} className="space-y-8" noValidate>
      <Bloque n="1" titulo="¿Qué quieres registrar?">
        <Segmento
          id="lr-tipo"
          valor={f.tipo}
          onChange={(v) => set("tipo", v)}
          opciones={[
            { v: "reclamo", l: "Reclamo", d: "Disconformidad con el producto o servicio" },
            { v: "queja", l: "Queja", d: "Malestar con la atención recibida" },
          ]}
        />
      </Bloque>

      <Bloque n="2" titulo="Identificación del consumidor">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nombre completo" id="lr-nombre" requerido>
            <input id="lr-nombre" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} className="field-lux" maxLength={160} autoComplete="name" required />
          </Campo>
          <Campo label="DNI o carné de extranjería" id="lr-documento" requerido>
            <input id="lr-documento" value={f.documento} onChange={(e) => set("documento", e.target.value)} className="field-lux tabular-nums" maxLength={20} inputMode="numeric" required />
          </Campo>
          <Campo label="Domicilio" id="lr-domicilio" requerido className="sm:col-span-2">
            <input id="lr-domicilio" value={f.domicilio} onChange={(e) => set("domicilio", e.target.value)} className="field-lux" maxLength={240} autoComplete="street-address" required />
          </Campo>
          <Campo label="Teléfono" id="lr-telefono" hint="Teléfono o correo: al menos uno.">
            <PhoneInput id="lr-telefono" value={f.telefono} onChange={(v) => set("telefono", v)} />
          </Campo>
          <Campo label="Correo electrónico" id="lr-email">
            <input id="lr-email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className="field-lux" maxLength={160} autoComplete="email" />
          </Campo>
          <label className="flex cursor-pointer items-start gap-3 rounded-lux border border-line px-4 py-3 text-sm text-ink-2 sm:col-span-2">
            <input type="checkbox" checked={f.menorDeEdad} onChange={(e) => set("menorDeEdad", e.target.checked)} className="mt-0.5 h-4 w-4 accent-silver" />
            <span>Soy menor de edad</span>
          </label>
          {f.menorDeEdad ? (
            <Campo label="Nombre del padre, madre o apoderado" id="lr-apoderado" requerido className="sm:col-span-2">
              <input id="lr-apoderado" value={f.apoderado} onChange={(e) => set("apoderado", e.target.value)} className="field-lux" maxLength={160} />
            </Campo>
          ) : null}
        </div>
      </Bloque>

      <Bloque n="3" titulo="Identificación del bien contratado">
        <div className="grid gap-4 sm:grid-cols-2">
          <Segmento
            id="lr-bien"
            valor={f.bienTipo}
            onChange={(v) => set("bienTipo", v)}
            opciones={[
              { v: "servicio", l: "Servicio" },
              { v: "producto", l: "Producto" },
            ]}
            className="sm:col-span-2"
          />
          <Campo label="Descripción" id="lr-bien-desc" requerido hint="Ejemplo: importación a pedido, consignación, escaneo pre-compra, compra de stock.">
            <input id="lr-bien-desc" value={f.bienDescripcion} onChange={(e) => set("bienDescripcion", e.target.value)} className="field-lux" maxLength={500} required />
          </Campo>
          <Campo label="Monto reclamado" id="lr-monto" hint="Opcional. En dólares.">
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-ink-4">US$</span>
              <input id="lr-monto" inputMode="decimal" value={f.montoUsd} onChange={(e) => set("montoUsd", e.target.value)} className="field-lux !pl-14 tabular-nums" />
            </div>
          </Campo>
        </div>
      </Bloque>

      <Bloque n="4" titulo="Detalle y pedido">
        <div className="grid gap-4">
          <Campo label="¿Qué pasó?" id="lr-detalle" requerido>
            <textarea id="lr-detalle" value={f.detalle} onChange={(e) => set("detalle", e.target.value)} className="field-lux min-h-32 resize-y" maxLength={4000} required />
          </Campo>
          <Campo label="¿Qué pides?" id="lr-pedido" requerido>
            <textarea id="lr-pedido" value={f.pedido} onChange={(e) => set("pedido", e.target.value)} className="field-lux min-h-20 resize-y" maxLength={2000} required />
          </Campo>
          <label className="flex cursor-pointer items-start gap-3 rounded-lux border border-line px-4 py-3 text-sm text-ink-2">
            <input type="checkbox" checked={f.acepta} onChange={(e) => set("acepta", e.target.checked)} className="mt-0.5 h-4 w-4 accent-silver" required />
            <span>Declaro que la información es verdadera y acepto el tratamiento de mis datos para atender esta hoja.</span>
          </label>
          <input type="text" name="empresa" value={f.empresa} onChange={(e) => set("empresa", e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
        </div>
      </Bloque>

      {estado.fase === "error" ? (
        <p role="alert" className="rounded-lux border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-ink-2">
          {estado.mensaje}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" variant="primary" size="lg" disabled={ocupado}>
          {ocupado ? "Registrando…" : "Registrar la hoja"}
        </Button>
        <p className="text-xs text-ink-4">Recibes el número de hoja al instante.</p>
      </div>
    </form>
  );
}

function Bloque({ n, titulo, children }: { n: string; titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="panel-lux p-6">
      <legend className="flex items-center gap-3 px-2 text-sm font-semibold text-ink">
        <span className="font-mono text-xs text-silver">{n.padStart(2, "0")}</span>
        {titulo}
      </legend>
      <div className="mt-4">{children}</div>
    </fieldset>
  );
}

function Campo({ label, id, hint, requerido, className, children }: { label: string; id: string; hint?: string; requerido?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm text-ink-2">
        {label}
        {requerido ? <span aria-hidden className="ml-1 text-silver">*</span> : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-ink-4">{hint}</p> : null}
    </div>
  );
}

function Segmento<T extends string>({ id, valor, opciones, onChange, className }: { id: string; valor: T; opciones: { v: T; l: string; d?: string }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="group" aria-label={id} className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {opciones.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={valor === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "field-lux flex flex-col items-start text-left transition-colors",
            valor === o.v ? "!border-silver !bg-surface-3 text-ink" : "text-ink-3 hover:text-ink",
          )}
        >
          <span className="text-sm font-semibold">{o.l}</span>
          {o.d ? <span className="mt-0.5 text-xs font-normal text-ink-4">{o.d}</span> : null}
        </button>
      ))}
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-4">{k}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-ink">{v}</dd>
    </div>
  );
}
