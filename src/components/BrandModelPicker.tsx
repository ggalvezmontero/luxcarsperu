"use client";

/**
 * Selector de marca y modelo con catálogo (src/data/vehicleCatalog.ts).
 *
 * Dos `<select>` encadenados: la marca filtra los modelos. Cada uno tiene la
 * opción "Otra…" que revela un campo de texto, así que el catálogo orienta
 * pero no limita. El valor que sale es siempre texto plano (`brand`, `model`),
 * igual que antes: la calculadora, el motor de origen y las solicitudes no
 * cambian.
 *
 * Si llega un valor que no está en el catálogo (formulario guardado, preset
 * de "más buscados"), se muestra en modo "Otra…" con el texto tal cual.
 */

import { useState, type ReactNode } from "react";
import { VEHICLE_CATALOG, findCatalogBrand, findCatalogModel } from "@/data/vehicleCatalog";

const OTHER = "__otro__";

type Props = {
  brand: string;
  model: string;
  onChange: (next: { brand: string; model: string }) => void;
  /** Prefijo de los `id` de los campos, para que las etiquetas apunten bien. */
  idPrefix: string;
  /** Envoltorio de cada campo (etiqueta + control). Por defecto, uno simple. */
  renderField?: (props: { label: string; htmlFor: string; children: ReactNode }) => ReactNode;
};

function DefaultField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm text-ink-2">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function BrandModelPicker({ brand, model, onChange, idPrefix, renderField }: Props) {
  const Field = renderField ?? DefaultField;

  const catalogBrand = findCatalogBrand(brand);
  const catalogModel = catalogBrand ? findCatalogModel(catalogBrand, model) : null;

  // "Otra…" queda elegido mientras el usuario escribe, aunque el texto esté
  // vacío o coincida por casualidad con el catálogo.
  const [brandIsOther, setBrandIsOther] = useState(() => Boolean(brand.trim()) && !catalogBrand);
  const [modelIsOther, setModelIsOther] = useState(() => Boolean(model.trim()) && !catalogModel);

  const brandSelectValue = brandIsOther || (!catalogBrand && brand.trim()) ? OTHER : (catalogBrand?.name ?? "");
  const modelSelectValue = modelIsOther || (!catalogModel && model.trim()) ? OTHER : (catalogModel ?? "");

  const handleBrandSelect = (value: string) => {
    if (value === OTHER) {
      setBrandIsOther(true);
      setModelIsOther(true);
      onChange({ brand: "", model: "" });
      return;
    }
    setBrandIsOther(false);
    setModelIsOther(false);
    onChange({ brand: value, model: "" });
  };

  const handleModelSelect = (value: string) => {
    if (value === OTHER) {
      setModelIsOther(true);
      onChange({ brand, model: "" });
      return;
    }
    setModelIsOther(false);
    onChange({ brand, model: value });
  };

  const showBrandText = brandSelectValue === OTHER;
  const showModelText = showBrandText || modelSelectValue === OTHER;

  return (
    <>
      <Field label="Marca" htmlFor={`${idPrefix}-brand`}>
        <select
          id={`${idPrefix}-brand`}
          value={brandSelectValue}
          onChange={(e) => handleBrandSelect(e.target.value)}
          className="field-lux select-lux"
        >
          <option value="">Selecciona la marca</option>
          {VEHICLE_CATALOG.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}
            </option>
          ))}
          <option value={OTHER}>Otra marca…</option>
        </select>
        {showBrandText ? (
          <input
            id={`${idPrefix}-brand-text`}
            aria-label="Otra marca"
            value={brand}
            onChange={(e) => onChange({ brand: e.target.value, model })}
            placeholder="Escribe la marca"
            autoComplete="off"
            autoCapitalize="words"
            className="field-lux mt-2"
          />
        ) : null}
      </Field>

      <Field label="Modelo" htmlFor={showBrandText ? `${idPrefix}-model-text` : `${idPrefix}-model`}>
        {!showBrandText ? (
          <select
            id={`${idPrefix}-model`}
            value={modelSelectValue}
            onChange={(e) => handleModelSelect(e.target.value)}
            disabled={!catalogBrand}
            className="field-lux select-lux"
          >
            <option value="">{catalogBrand ? "Selecciona el modelo" : "Primero la marca"}</option>
            {catalogBrand?.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {catalogBrand ? <option value={OTHER}>Otro modelo…</option> : null}
          </select>
        ) : null}
        {showModelText ? (
          <input
            id={`${idPrefix}-model-text`}
            aria-label="Otro modelo"
            value={model}
            onChange={(e) => onChange({ brand, model: e.target.value })}
            placeholder="Escribe el modelo"
            autoComplete="off"
            autoCapitalize="words"
            className={showBrandText ? "field-lux" : "field-lux mt-2"}
          />
        ) : null}
      </Field>
    </>
  );
}
