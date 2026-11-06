"use client";

/**
 * Formulario de alta y edición de un ejemplo de importación a pedido.
 *
 * Arma el objeto `datos` con lo que hay en pantalla y lo pasa por
 * `validarEjemplo`, que es la ÚNICA fuente de las reglas (foto propia y con
 * licencia, crédito si la licencia lo exige, simulación solo si el auto se
 * consigue en EE.UU.). Acá no se repiten: lo que hay son ayudas de
 * escritura —slug sugerido, precio único que vale para mínimo y máximo— y el
 * mensaje de error debajo del campo que nombra `campo`.
 *
 * FOTOS. Al subir, el archivo va al bucket enseguida (es la única forma de
 * tener una URL que guardar). Por eso el formulario lleva la cuenta:
 *   · una subida que todavía no se guardó y se reemplaza, se quita o se
 *     cancela, se borra en el momento: nadie más la usa;
 *   · la foto que el ejemplo tenía antes se borra recién DESPUÉS de guardar
 *     bien, y solo si era una foto subida al bucket (`ejemplos/…`). Las rutas
 *     locales `/images/…` viven en el repositorio y no se tocan nunca.
 */

import { BrandModelPicker } from "@/components/BrandModelPicker";
import { Button } from "@/components/Button";
import { PortalPanel } from "@/components/portal/CrmUI";
import type { TrendingVehicle } from "@/data/trendingVehicles";
import {
  AD_VALOREM_STATUSES,
  EXAMPLE_ID_PATTERN,
  EXAMPLE_LIMITS,
  EXAMPLE_PLANS,
  EXAMPLE_VEHICLE_TYPES,
  IMPORT_VIABILITIES,
  PRICE_BASES,
  validarEjemplo,
} from "@/lib/importExamples/validacion";
import {
  TIPOS_FOTO_EJEMPLO,
  quitarFotoEjemplo,
  rutaDeFotoEjemplo,
  subirFotoEjemplo,
  type FotoEjemploSubida,
} from "@/lib/portal/ejemploFotos";
import type { PortalClient } from "@/lib/portal/portalClient";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AD_VALOREM_LABEL,
  PLAN_LABEL,
  PRICE_BASIS_LABEL,
  VEHICLE_TYPE_LABEL,
  VIABILITY_LABEL,
} from "./etiquetas";
import { fotoEnUso, type Ejemplo, type EjemploMutationResult } from "./queries";

const L = EXAMPLE_LIMITS;

const LICENCIA_PROPIA = "Foto propia de LuxCars";
const LICENCIAS = [LICENCIA_PROPIA, "CC0 1.0", "CC BY 4.0", "CC BY-SA 4.0"] as const;
const OTRA_LICENCIA = "__otra__";

/** Campos que viven dentro de "Datos de respaldo": si fallan, se abre la sección. */
const CAMPOS_RESPALDO = new Set(["detail", "assemblyCountry", "assemblyPlant", "adValorem", "adValoremNote"]);

/** Campos que tienen un lugar propio en pantalla. El resto se muestra al pie. */
const CAMPOS_CON_LUGAR = new Set([
  "id",
  "name",
  "segment",
  "priceMinUsd",
  "priceMaxUsd",
  "priceBasis",
  "priceNote",
  "availableInUsDealers",
  "calculator",
  "calculator.brand",
  "calculator.model",
  "calculator.priceUsd",
  "calculator.vehicleType",
  "calculator.preferredPlan",
  "importViability",
  "imageSrc",
  "imageAlt",
  "imageLicense",
  "imageCredit",
  "imageSourceUrl",
  ...CAMPOS_RESPALDO,
]);

const digits = (v: string) => v.replace(/[^0-9]/g, "");

/** Monto en USD enteros, mostrado con comas de miles. */
function montoVisible(v: string): string {
  return v ? Number(v).toLocaleString("en-US") : "";
}

/** Igual que el presupuesto de /cuenta/comprar: un ",50" final puede ser un dígito borrado. */
function montoEscrito(v: string): string {
  return digits(v.replace(/\.\d{1,2}$/, "")).slice(0, 8);
}

function entero(v: string): number | null {
  return v === "" ? null : Number(v);
}

/**
 * Identificador sugerido a partir del nombre. Se quita el año final porque el
 * id es un enlace permanente y el modelo cambia de año todos los años
 * ("Ford Bronco Raptor 2026" → "ford-bronco-raptor", como los existentes).
 */
function sugerirId(nombre: string): string {
  const base = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\s*$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length <= L.id) return base;
  return base.slice(0, L.id).replace(/-[^-]*$/, "").replace(/-+$/, "");
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): string => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? String(v) : "");

type Estado = {
  id: string;
  /** `true` cuando el admin escribió el id a mano: deja de seguir al nombre. */
  idTocado: boolean;
  name: string;
  segment: string;
  priceMin: string;
  priceMax: string;
  priceBasis: string;
  priceNote: string;
  enEeuu: boolean;
  calcBrand: string;
  calcModel: string;
  calcPrice: string;
  calcType: string;
  calcPlan: string;
  viability: string;
  imageSrc: string | null;
  imageAlt: string;
  licencia: string;
  licenciaOtra: string;
  imageCredit: string;
  imageSourceUrl: string;
  detail: string;
  assemblyCountry: string;
  assemblyPlant: string;
  adValorem: string;
  adValoremNote: string;
};

function estadoInicial(inicial: Ejemplo | null): Estado {
  const d = inicial?.datos ?? {};
  const c =
    d.calculator && typeof d.calculator === "object" && !Array.isArray(d.calculator)
      ? (d.calculator as Record<string, unknown>)
      : {};
  const licencia = str(d.imageLicense).trim();
  const licenciaConocida = (LICENCIAS as readonly string[]).includes(licencia);
  return {
    id: inicial?.id ?? "",
    idTocado: Boolean(inicial),
    name: str(d.name),
    segment: str(d.segment),
    priceMin: num(d.priceMinUsd),
    priceMax: num(d.priceMaxUsd),
    // Uno nuevo arranca en "referencial": es lo prudente hasta verificar un MSRP.
    priceBasis: inicial ? str(d.priceBasis) : "referencial-miami",
    priceNote: str(d.priceNote),
    enEeuu: typeof d.availableInUsDealers === "boolean" ? d.availableInUsDealers : true,
    calcBrand: str(c.brand),
    calcModel: str(c.model),
    calcPrice: num(c.priceUsd),
    calcType: str(c.vehicleType) || "gasolina",
    calcPlan: inicial ? str(c.preferredPlan) : "fast",
    viability: str(d.importViability),
    imageSrc: str(d.imageSrc).trim() || null,
    imageAlt: str(d.imageAlt),
    licencia: licenciaConocida ? licencia : licencia ? OTRA_LICENCIA : "",
    licenciaOtra: licenciaConocida ? "" : licencia,
    imageCredit: str(d.imageCredit),
    imageSourceUrl: str(d.imageSourceUrl),
    detail: str(d.detail),
    assemblyCountry: str(d.assemblyCountry),
    assemblyPlant: str(d.assemblyPlant),
    // Uno nuevo arranca en "depende del VIN": se cotiza 6% hasta verlo.
    adValorem: inicial ? str(d.adValorem) : "depende-vin",
    adValoremNote: str(d.adValoremNote),
  };
}

export function EjemploForm({
  client,
  inicial,
  idsExistentes,
  guardar,
  onGuardado,
  onCancelar,
}: {
  client: PortalClient;
  /** `null` = ejemplo nuevo. */
  inicial: Ejemplo | null;
  /** Para avisar de un identificador repetido antes de ir a la base. */
  idsExistentes: string[];
  /** Escribe en la base. Recibe solo objetos que salieron de `validarEjemplo`. */
  guardar: (vehiculo: TrendingVehicle) => Promise<EjemploMutationResult>;
  /** Se llama tras guardar bien (y tras limpiar la foto anterior). */
  onGuardado: (resultado: EjemploMutationResult) => void;
  onCancelar: () => void;
}) {
  const creando = inicial === null;
  const [f, setF] = useState<Estado>(() => estadoInicial(inicial));
  const [errorCampo, setErrorCampo] = useState<{ campo: string; error: string } | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [respaldoAbierto, setRespaldoAbierto] = useState(false);

  const [subiendo, setSubiendo] = useState(false);
  const [avisoFoto, setAvisoFoto] = useState<{ ok: boolean; text: string } | null>(null);
  // La subida de esta sesión que todavía no se guardó. En estado para pintar y
  // en un ref para que la limpieza al desmontar vea el último valor.
  const [pendiente, setPendiente] = useState<FotoEjemploSubida | null>(null);
  const pendienteRef = useRef<FotoEjemploSubida | null>(null);
  const inputFotoRef = useRef<HTMLInputElement | null>(null);

  const fotoOriginal = inicial ? str(inicial.datos.imageSrc).trim() || null : null;
  const warningsOriginales = inicial && Array.isArray(inicial.datos.warnings) ? inicial.datos.warnings : [];

  // Si el formulario desaparece sin guardar (el admin se va a otra sección del
  // portal), la subida pendiente quedaría huérfana en el bucket: se borra.
  useEffect(() => {
    return () => {
      const huerfana = pendienteRef.current;
      if (huerfana) void quitarFotoEjemplo(huerfana.path);
    };
  }, []);

  function marcarPendiente(foto: FotoEjemploSubida | null) {
    pendienteRef.current = foto;
    setPendiente(foto);
  }

  function set<K extends keyof Estado>(campo: K, valor: Estado[K]) {
    setF((prev) => ({ ...prev, [campo]: valor }));
  }

  const errorDe = (campo: string): string | null => (errorCampo?.campo === campo ? errorCampo.error : null);

  function senalarError(campo: string, error: string) {
    setErrorCampo({ campo, error });
    if (CAMPOS_RESPALDO.has(campo)) setRespaldoAbierto(true);
    // Después del render (la sección de respaldo puede tener que abrirse).
    requestAnimationFrame(() => {
      const nodo = document.getElementById(`err-${campo}`) ?? document.getElementById("err-general");
      nodo?.scrollIntoView({ behavior: "smooth", block: "center" });
      const control = document.getElementById(`ej-${campo.replace(/\./g, "-")}`);
      if (control instanceof HTMLElement) control.focus({ preventScroll: true });
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Foto                                                                     */
  /* ------------------------------------------------------------------------ */

  async function alElegirFoto(file: File | undefined) {
    if (!file) return;
    setAvisoFoto(null);
    setSubiendo(true);
    const r = await subirFotoEjemplo(file);
    setSubiendo(false);
    if (inputFotoRef.current) inputFotoRef.current.value = "";
    if (!r.ok) {
      setAvisoFoto({ ok: false, text: r.mensaje });
      return;
    }
    // Una subida anterior de esta misma sesión nunca se guardó: sobra.
    const anterior = pendienteRef.current;
    if (anterior) void quitarFotoEjemplo(anterior.path);
    marcarPendiente(r.foto);
    set("imageSrc", r.foto.publicUrl);
    setAvisoFoto({
      ok: true,
      text: r.nota ?? "Foto subida. Se publica cuando guardes el ejemplo.",
    });
  }

  function quitarFoto() {
    const anterior = pendienteRef.current;
    if (anterior) void quitarFotoEjemplo(anterior.path);
    marcarPendiente(null);
    set("imageSrc", null);
    setAvisoFoto(
      fotoOriginal ? { ok: true, text: "La foto se quita de la web cuando guardes." } : null,
    );
  }

  function elegirLicencia(valor: string) {
    setF((prev) => ({
      ...prev,
      licencia: valor,
      // La validación trata cualquier licencia que no sea CC0 como "exige
      // crédito y enlace". Para una foto propia se completa con LuxCars y el
      // sitio, editable, en vez de obligar a inventar algo.
      ...(valor === LICENCIA_PROPIA
        ? {
            imageCredit: prev.imageCredit.trim() ? prev.imageCredit : "LuxCars",
            imageSourceUrl: prev.imageSourceUrl.trim() ? prev.imageSourceUrl : "https://luxcars.pe",
          }
        : {}),
    }));
  }

  /* ------------------------------------------------------------------------ */
  /* Guardar y cancelar                                                       */
  /* ------------------------------------------------------------------------ */

  function cancelar() {
    const anterior = pendienteRef.current;
    if (anterior) void quitarFotoEjemplo(anterior.path);
    marcarPendiente(null);
    onCancelar();
  }

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorCampo(null);
    setErrorGeneral(null);

    const id = f.id.trim();
    if (creando) {
      // Pre-chequeos de comodidad; la regla real la aplica `validarEjemplo`.
      if (!id) return senalarError("id", "Escribe el identificador (se sugiere solo al escribir el nombre).");
      if (EXAMPLE_ID_PATTERN.test(id) && idsExistentes.includes(id)) {
        return senalarError("id", "Ya existe un ejemplo con ese identificador. Elige otro.");
      }
    }

    // Si solo se escribió un precio, vale para mínimo y máximo.
    const min = entero(f.priceMin);
    const max = entero(f.priceMax);
    const priceMinUsd = min ?? max;
    const priceMaxUsd = max ?? min;
    const licencia = f.licencia === OTRA_LICENCIA ? f.licenciaOtra : f.licencia;

    const datos = {
      id,
      name: f.name,
      detail: f.detail,
      segment: f.segment,
      priceMinUsd,
      priceMaxUsd,
      priceBasis: f.priceBasis,
      priceNote: f.priceNote,
      assemblyCountry: f.assemblyCountry,
      assemblyPlant: f.assemblyPlant,
      adValorem: f.adValorem,
      adValoremNote: f.adValoremNote,
      availableInUsDealers: f.enEeuu,
      importViability: f.viability,
      // No se editan en esta versión: se conserva lo que tenía la fila.
      warnings: warningsOriginales,
      imageSrc: f.imageSrc,
      imageAlt: f.imageAlt,
      imageLicense: licencia,
      imageCredit: f.imageCredit,
      imageSourceUrl: f.imageSourceUrl,
      calculator: f.enEeuu
        ? {
            brand: f.calcBrand,
            model: f.calcModel,
            // Vacío = el precio mínimo, que es lo que el cliente ve primero.
            priceUsd: entero(f.calcPrice) ?? priceMinUsd,
            vehicleType: f.calcType,
            preferredPlan: f.calcPlan || undefined,
          }
        : null,
    };

    const v = validarEjemplo(datos);
    if (!v.ok) return senalarError(v.campo, v.error);

    setGuardando(true);
    const r = await guardar(v.vehiculo);
    if (!r.ok) {
      setGuardando(false);
      if (r.campo) senalarError(r.campo, r.message);
      else setErrorGeneral(r.message);
      return;
    }

    // Guardado: la subida ya no es huerfana, y la foto anterior —si era una
    // subida al bucket y ya no se usa en ningún ejemplo— sobra.
    marcarPendiente(null);
    const rutaVieja = rutaDeFotoEjemplo(fotoOriginal);
    if (fotoOriginal && rutaVieja && fotoOriginal !== v.vehiculo.imageSrc) {
      if (!(await fotoEnUso(client, fotoOriginal))) await quitarFotoEjemplo(rutaVieja);
    }
    setGuardando(false);
    onGuardado(r);
  }

  const errorSinLugar = errorCampo && !CAMPOS_CON_LUGAR.has(errorCampo.campo) ? errorCampo.error : null;
  const enlacePublico = f.id.trim() || "identificador";

  return (
    <PortalPanel
      title={creando ? "Nuevo ejemplo" : `Editar · ${inicial?.vehiculo?.name || str(inicial?.datos.name) || inicial?.id}`}
      description="Lo que guardes acá se publica en la home y en /importar. Las reglas son las mismas que antes tenía el archivo del repositorio."
    >
      <form onSubmit={enviar} noValidate className="space-y-8 px-5 py-6">
        {/* ---------------------------------------------------------------- */}
        <Bloque titulo="El auto">
          <Campo
            id="ej-name"
            label="Nombre"
            hint="Es el título de la tarjeta. Nombre oficial del fabricante, con el año (ej. Ford Bronco Raptor 2026)."
            error={errorDe("name")}
            campo="name"
            className="sm:col-span-2"
          >
            <input
              id="ej-name"
              value={f.name}
              maxLength={L.name}
              onChange={(e) => {
                const name = e.target.value;
                setF((prev) => ({ ...prev, name, ...(creando && !prev.idTocado ? { id: sugerirId(name) } : {}) }));
              }}
              className="field-lux min-h-10 py-1.5 text-sm"
            />
          </Campo>

          <Campo
            id="ej-id"
            label="Identificador"
            hint={
              creando
                ? `Se sugiere solo a partir del nombre. Es parte del enlace público (luxcars.pe/?simular=${enlacePublico}) y no se puede cambiar después. Solo minúsculas, números y guiones.`
                : "Es parte del enlace público del ejemplo: no se cambia."
            }
            error={errorDe("id")}
            campo="id"
          >
            <input
              id="ej-id"
              value={f.id}
              readOnly={!creando}
              maxLength={L.id}
              onChange={(e) =>
                setF((prev) => ({
                  ...prev,
                  id: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                  idTocado: e.target.value.trim() !== "",
                }))
              }
              className={cn("field-lux min-h-10 py-1.5 font-mono text-sm", !creando && "cursor-not-allowed opacity-70")}
            />
          </Campo>

          <Campo
            id="ej-segment"
            label="Segmento"
            hint="Ej. SUV · gasolina. La etiqueta de la tarjeta muestra la parte antes del «·»."
            error={errorDe("segment")}
            campo="segment"
          >
            <input
              id="ej-segment"
              value={f.segment}
              maxLength={L.segment}
              onChange={(e) => set("segment", e.target.value)}
              placeholder="SUV · gasolina"
              className="field-lux min-h-10 py-1.5 text-sm"
            />
          </Campo>
        </Bloque>

        {/* ---------------------------------------------------------------- */}
        <Bloque titulo="Precio en EE.UU.">
          <Campo
            id="ej-priceMinUsd"
            label="Desde (USD)"
            hint="Dólares enteros. Si es un precio único, escríbelo solo acá."
            error={errorDe("priceMinUsd")}
            campo="priceMinUsd"
          >
            <MontoUsd id="ej-priceMinUsd" value={f.priceMin} onChange={(v) => set("priceMin", v)} />
          </Campo>
          <Campo
            id="ej-priceMaxUsd"
            label="Hasta (USD)"
            hint="Opcional. Para un rango entre versiones o acabados."
            error={errorDe("priceMaxUsd")}
            campo="priceMaxUsd"
          >
            <MontoUsd id="ej-priceMaxUsd" value={f.priceMax} onChange={(v) => set("priceMax", v)} />
          </Campo>
          <Campo
            id="ej-priceBasis"
            label="¿De dónde sale el precio?"
            hint="Una cifra exacta solo con MSRP oficial verificado. Si no, rango referencial: la web lo rotula así."
            error={errorDe("priceBasis")}
            campo="priceBasis"
            className="sm:col-span-2"
          >
            <select
              id="ej-priceBasis"
              value={f.priceBasis}
              onChange={(e) => set("priceBasis", e.target.value)}
              className="field-lux select-lux min-h-10 py-1.5 text-sm"
            >
              <option value="">Elige…</option>
              {PRICE_BASES.map((b) => (
                <option key={b} value={b}>
                  {PRICE_BASIS_LABEL[b]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo
            id="ej-priceNote"
            label="Nota del precio"
            hint="Opcional. Qué incluye y qué no (destination charge, ajuste del dealer, flete). Se muestra al cliente."
            error={errorDe("priceNote")}
            campo="priceNote"
            className="sm:col-span-2"
          >
            <textarea
              id="ej-priceNote"
              rows={2}
              value={f.priceNote}
              maxLength={L.priceNote}
              onChange={(e) => set("priceNote", e.target.value)}
              className="field-lux min-h-16 py-1.5 text-sm"
            />
          </Campo>
        </Bloque>

        {/* ---------------------------------------------------------------- */}
        <Bloque titulo="Calculadora">
          <div className="sm:col-span-2">
            <span id="ej-availableInUsDealers-label" className="block text-sm text-ink-2">
              ¿Se consigue en dealers de EE.UU.?
            </span>
            <div
              id="ej-availableInUsDealers"
              role="group"
              aria-labelledby="ej-availableInUsDealers-label"
              tabIndex={-1}
              className="mt-1.5 grid max-w-sm grid-cols-2 gap-2"
            >
              {(
                [
                  [true, "Sí"],
                  [false, "No"],
                ] as const
              ).map(([valor, texto]) => (
                <button
                  key={texto}
                  type="button"
                  aria-pressed={f.enEeuu === valor}
                  onClick={() => set("enEeuu", valor)}
                  className={cn(
                    "field-lux flex min-h-10 items-center justify-center py-1.5 text-sm font-semibold transition-colors",
                    f.enEeuu === valor ? "!border-silver !bg-surface-3 text-ink" : "text-ink-3 hover:text-ink",
                  )}
                >
                  {texto}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink-4">
              {f.enEeuu
                ? "La tarjeta lleva a la calculadora con este auto precargado: completa los datos de abajo."
                : "Sin simulación: no se cotiza la importación de un auto que no se puede comprar allá (ej. marcas chinas que ya se venden nuevas en Perú)."}
            </p>
            <ErrorCampo campo="availableInUsDealers" error={errorDe("availableInUsDealers")} />
            <ErrorCampo campo="calculator" error={errorDe("calculator")} />
          </div>

          {f.enEeuu ? (
            <>
              <BrandModelPicker
                idPrefix="ej-calculator"
                brand={f.calcBrand}
                model={f.calcModel}
                onChange={(next) => setF((prev) => ({ ...prev, calcBrand: next.brand, calcModel: next.model }))}
                renderField={({ label, htmlFor, children }) => (
                  <Campo
                    id={htmlFor}
                    label={`${label} (calculadora)`}
                    campo={label === "Marca" ? "calculator.brand" : "calculator.model"}
                    error={errorDe(label === "Marca" ? "calculator.brand" : "calculator.model")}
                  >
                    {children}
                  </Campo>
                )}
              />
              <Campo
                id="ej-calculator-priceUsd"
                label="Precio para la simulación (USD)"
                hint={`Si lo dejas vacío se usa el precio “desde”${f.priceMin ? ` (USD ${montoVisible(f.priceMin)})` : ""}.`}
                error={errorDe("calculator.priceUsd")}
                campo="calculator.priceUsd"
              >
                <MontoUsd
                  id="ej-calculator-priceUsd"
                  value={f.calcPrice}
                  placeholder={montoVisible(f.priceMin || f.priceMax)}
                  onChange={(v) => set("calcPrice", v)}
                />
              </Campo>
              <Campo
                id="ej-calculator-vehicleType"
                label="Motor"
                hint="Decide los impuestos que aplica la calculadora."
                error={errorDe("calculator.vehicleType")}
                campo="calculator.vehicleType"
              >
                <select
                  id="ej-calculator-vehicleType"
                  value={f.calcType}
                  onChange={(e) => set("calcType", e.target.value)}
                  className="field-lux select-lux min-h-10 py-1.5 text-sm"
                >
                  {EXAMPLE_VEHICLE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {VEHICLE_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo
                id="ej-calculator-preferredPlan"
                label="Plan de entrega sugerido"
                error={errorDe("calculator.preferredPlan")}
                campo="calculator.preferredPlan"
              >
                <select
                  id="ej-calculator-preferredPlan"
                  value={f.calcPlan}
                  onChange={(e) => set("calcPlan", e.target.value)}
                  className="field-lux select-lux min-h-10 py-1.5 text-sm"
                >
                  {f.calcPlan === "" ? <option value="">Sin preferencia</option> : null}
                  {EXAMPLE_PLANS.map((p) => (
                    <option key={p} value={p}>
                      {PLAN_LABEL[p]}
                    </option>
                  ))}
                </select>
              </Campo>
            </>
          ) : null}

          <Campo
            id="ej-importViability"
            label="¿Conviene importarlo?"
            hint="«No conviene» es para los contraejemplos honestos: autos que ya se venden nuevos en Perú más baratos."
            error={errorDe("importViability")}
            campo="importViability"
            className="sm:col-span-2"
          >
            <select
              id="ej-importViability"
              value={f.viability}
              onChange={(e) => set("viability", e.target.value)}
              className="field-lux select-lux min-h-10 max-w-sm py-1.5 text-sm"
            >
              <option value="">Elige…</option>
              {IMPORT_VIABILITIES.map((v) => (
                <option key={v} value={v}>
                  {VIABILITY_LABEL[v]}
                </option>
              ))}
            </select>
          </Campo>
        </Bloque>

        {/* ---------------------------------------------------------------- */}
        <Bloque titulo="Foto">
          <div className="sm:col-span-2">
            <p className="rounded-lux border border-warn/30 bg-warn/5 px-4 py-3 text-xs leading-relaxed text-ink-2">
              Solo fotos propias de LuxCars o con una licencia que permita uso comercial (CC0, CC BY, CC BY-SA). No se
              usan fotos de otras páginas web ni de marketplaces (eBay, Autotrader, Cars.com, CarGurus, Facebook
              Marketplace…), ni de salas de prensa de fabricantes. Si no tienes una foto así, déjalo sin foto: la
              tarjeta se ve bien sin ella.
            </p>
          </div>

          <div className="sm:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-36 w-full shrink-0 items-center justify-center overflow-hidden rounded-lux border border-line bg-surface-2 sm:w-56">
                {f.imageSrc ? (
                  // `<img>` y no `next/image`: el bucket no está declarado en
                  // next.config.ts y este es el panel interno (ver SubidorFotos).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.imageSrc} alt={f.imageAlt || "Vista previa"} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs uppercase tracking-[0.16em] text-ink-4">Sin foto</span>
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={inputFotoRef}
                  id="ej-imageSrc"
                  type="file"
                  accept={TIPOS_FOTO_EJEMPLO.join(",")}
                  className="sr-only"
                  onChange={(e) => void alElegirFoto(e.target.files?.[0])}
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" disabled={subiendo || guardando} onClick={() => inputFotoRef.current?.click()}>
                    {subiendo ? "Subiendo…" : f.imageSrc ? "Reemplazar foto" : "Subir foto"}
                  </Button>
                  {f.imageSrc ? (
                    <Button size="sm" variant="ghost" className="border border-line" disabled={subiendo || guardando} onClick={quitarFoto}>
                      Quitar foto
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-ink-4">JPEG, PNG, WebP o AVIF. Se reduce sola antes de subir.</p>
                {f.imageSrc && !pendiente && f.imageSrc.startsWith("/") ? (
                  <p className="text-xs text-ink-4">Foto guardada en el sitio ({f.imageSrc}). Se conserva si no la cambias.</p>
                ) : null}
                {avisoFoto ? (
                  <p className={cn("text-xs", avisoFoto.ok ? "text-ink-3" : "text-danger")} role={avisoFoto.ok ? "status" : "alert"}>
                    {avisoFoto.text}
                  </p>
                ) : null}
                <ErrorCampo campo="imageSrc" error={errorDe("imageSrc")} />
              </div>
            </div>
          </div>

          <Campo
            id="ej-imageAlt"
            label="Descripción de la foto"
            hint="Describe lo que se ve: modelo, color, ángulo. Aclara que es imagen referencial del modelo, no de la unidad en venta."
            error={errorDe("imageAlt")}
            campo="imageAlt"
            className="sm:col-span-2"
          >
            <textarea
              id="ej-imageAlt"
              rows={2}
              value={f.imageAlt}
              maxLength={L.imageAlt}
              onChange={(e) => set("imageAlt", e.target.value)}
              className="field-lux min-h-16 py-1.5 text-sm"
            />
          </Campo>

          <Campo
            id="ej-imageLicense"
            label="Licencia"
            hint="CC BY y CC BY-SA exigen nombrar al autor y enlazar la página de la foto; la web publica ese crédito."
            error={errorDe("imageLicense")}
            campo="imageLicense"
          >
            <select
              id="ej-imageLicense"
              value={f.licencia}
              onChange={(e) => elegirLicencia(e.target.value)}
              className="field-lux select-lux min-h-10 py-1.5 text-sm"
            >
              <option value="">Elige…</option>
              {LICENCIAS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
              <option value={OTRA_LICENCIA}>Otra…</option>
            </select>
            {f.licencia === OTRA_LICENCIA ? (
              <input
                aria-label="Otra licencia"
                value={f.licenciaOtra}
                maxLength={L.imageLicense}
                onChange={(e) => set("licenciaOtra", e.target.value)}
                placeholder="Tal como la declara la fuente"
                className="field-lux mt-2 min-h-10 py-1.5 text-sm"
              />
            ) : null}
          </Campo>

          <Campo
            id="ej-imageCredit"
            label="Crédito (autor)"
            hint="Obligatorio con CC BY. Con foto propia, LuxCars."
            error={errorDe("imageCredit")}
            campo="imageCredit"
          >
            <input
              id="ej-imageCredit"
              value={f.imageCredit}
              maxLength={L.imageCredit}
              onChange={(e) => set("imageCredit", e.target.value)}
              className="field-lux min-h-10 py-1.5 text-sm"
            />
          </Campo>

          <Campo
            id="ej-imageSourceUrl"
            label="Página de origen de la foto"
            hint="Enlace a la obra (ej. la ficha en Wikimedia Commons). Obligatorio con CC BY."
            error={errorDe("imageSourceUrl")}
            campo="imageSourceUrl"
            className="sm:col-span-2"
          >
            <input
              id="ej-imageSourceUrl"
              type="url"
              inputMode="url"
              value={f.imageSourceUrl}
              maxLength={L.url}
              onChange={(e) => set("imageSourceUrl", e.target.value)}
              placeholder="https://commons.wikimedia.org/wiki/File:…"
              className="field-lux min-h-10 py-1.5 text-sm"
            />
          </Campo>
        </Bloque>

        {/* ---------------------------------------------------------------- */}
        <details
          open={respaldoAbierto}
          onToggle={(e) => setRespaldoAbierto(e.currentTarget.open)}
          className="rounded-lux border border-line bg-surface-2/40"
        >
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-ink">
            Datos de respaldo (no se muestran en la web)
          </summary>
          <div className="grid gap-4 border-t border-line px-4 py-5 sm:grid-cols-2">
            <Campo
              id="ej-detail"
              label="Descripción interna"
              hint="Por qué este auto está en la lista."
              error={errorDe("detail")}
              campo="detail"
              className="sm:col-span-2"
            >
              <textarea
                id="ej-detail"
                rows={3}
                value={f.detail}
                maxLength={L.detail}
                onChange={(e) => set("detail", e.target.value)}
                className="field-lux min-h-20 py-1.5 text-sm"
              />
            </Campo>
            <Campo id="ej-assemblyCountry" label="País de ensamblaje" hint="Decide el ad valorem, no la marca." error={errorDe("assemblyCountry")} campo="assemblyCountry">
              <input
                id="ej-assemblyCountry"
                value={f.assemblyCountry}
                maxLength={L.assembly}
                onChange={(e) => set("assemblyCountry", e.target.value)}
                className="field-lux min-h-10 py-1.5 text-sm"
              />
            </Campo>
            <Campo id="ej-assemblyPlant" label="Planta" hint="Opcional. Solo si es única y verificable." error={errorDe("assemblyPlant")} campo="assemblyPlant">
              <input
                id="ej-assemblyPlant"
                value={f.assemblyPlant}
                maxLength={L.assembly}
                onChange={(e) => set("assemblyPlant", e.target.value)}
                className="field-lux min-h-10 py-1.5 text-sm"
              />
            </Campo>
            <Campo
              id="ej-adValorem"
              label="Ad valorem (APC Perú–EE.UU.)"
              hint="Solo un auto nuevo y originario de EE.UU. llega a 0%."
              error={errorDe("adValorem")}
              campo="adValorem"
              className="sm:col-span-2"
            >
              <select
                id="ej-adValorem"
                value={f.adValorem}
                onChange={(e) => set("adValorem", e.target.value)}
                className="field-lux select-lux min-h-10 py-1.5 text-sm"
              >
                <option value="">Elige…</option>
                {AD_VALOREM_STATUSES.map((a) => (
                  <option key={a} value={a}>
                    {AD_VALOREM_LABEL[a]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="ej-adValoremNote" label="Nota de ad valorem" error={errorDe("adValoremNote")} campo="adValoremNote" className="sm:col-span-2">
              <textarea
                id="ej-adValoremNote"
                rows={3}
                value={f.adValoremNote}
                maxLength={L.adValoremNote}
                onChange={(e) => set("adValoremNote", e.target.value)}
                className="field-lux min-h-20 py-1.5 text-sm"
              />
            </Campo>
            {warningsOriginales.length > 0 ? (
              <p className="text-xs text-ink-4 sm:col-span-2">
                Este ejemplo tiene {warningsOriginales.length} advertencia{warningsOriginales.length === 1 ? "" : "s"} interna
                {warningsOriginales.length === 1 ? "" : "s"}. No se editan desde acá todavía: se conservan tal cual al guardar.
              </p>
            ) : null}
          </div>
        </details>

        {/* ---------------------------------------------------------------- */}
        <div id="err-general" className="space-y-3">
          {errorSinLugar ? (
            <p role="alert" className="rounded-lux border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-danger">
              {errorSinLugar}
            </p>
          ) : null}
          {errorGeneral ? (
            <p role="alert" className="rounded-lux border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-danger">
              {errorGeneral}
            </p>
          ) : null}
          {errorCampo && CAMPOS_CON_LUGAR.has(errorCampo.campo) ? (
            <p className="text-xs text-danger">Revisa el campo marcado: {errorCampo.error}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={guardando || subiendo}>
              {guardando ? "Guardando…" : creando ? "Crear ejemplo" : "Guardar cambios"}
            </Button>
            <Button variant="ghost" className="border border-line" disabled={guardando} onClick={cancelar}>
              Cancelar
            </Button>
          </div>
        </div>
      </form>
    </PortalPanel>
  );
}

/* ------------------------------------------------------------------------- */

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-[11px] font-medium uppercase tracking-[0.2em] text-silver">{titulo}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Campo({
  id,
  label,
  hint,
  campo,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  /** Nombre del campo según `validarEjemplo` (para anclar el error). */
  campo: string;
  error: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm text-ink-2">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-ink-4">{hint}</p> : null}
      <ErrorCampo campo={campo} error={error} />
    </div>
  );
}

function ErrorCampo({ campo, error }: { campo: string; error: string | null }) {
  if (!error) return null;
  return (
    <p id={`err-${campo}`} role="alert" className="mt-1.5 text-xs text-danger">
      {error}
    </p>
  );
}

function MontoUsd({
  id,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-ink-4">USD</span>
      <input
        id={id}
        inputMode="numeric"
        value={montoVisible(value)}
        placeholder={placeholder}
        onChange={(e) => onChange(montoEscrito(e.target.value))}
        className="field-lux min-h-10 py-1.5 pl-12 text-sm tabular-nums"
      />
    </div>
  );
}
