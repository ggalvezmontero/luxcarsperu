"use client";

/**
 * Desplegable con salida "Otro…": una lista de opciones frecuentes y, al
 * elegir "Otro…", un campo de texto para describirlo.
 *
 * El valor que entra y sale es SIEMPRE texto plano, igual que si fuera un
 * campo libre: quien lo usa no se entera de si vino de la lista o lo escribió
 * la persona. Por eso se puede poner en lugar de cualquier <input> de texto sin
 * tocar cómo se guarda el dato.
 *
 * Si llega un valor que no está en la lista (algo ya guardado, o lo que rellenó
 * el decodificador de VIN), se muestra en modo "Otro…" con el texto tal cual:
 * la lista orienta, no limita ni pierde datos.
 *
 * Mismo criterio que `BrandModelPicker`, generalizado a una sola lista.
 */

import { useState } from "react";

const OTRO = "__otro__";

/** Compara sin mayúsculas ni tildes: "suv" encuentra "SUV", "sedan" encuentra "Sedán". */
function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

type Props = {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  opciones: readonly string[];
  /** Texto de la opción vacía. Sin él, no hay opción vacía. */
  vacio?: string;
  /** Rótulo de la salida. Por defecto "Otro…"; "Otra…" para sustantivos femeninos. */
  etiquetaOtro?: string;
  /** Qué escribir en el campo que aparece al elegir "Otro…". */
  placeholderOtro?: string;
  /** Nombre accesible del campo de texto. */
  ariaLabelOtro?: string;
  /** Clases del <select> y del campo de texto. */
  className?: string;
  maxLength?: number;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
};

export function SelectConOtro({
  id,
  name,
  value,
  onChange,
  opciones,
  vacio,
  etiquetaOtro = "Otro…",
  placeholderOtro = "Descríbelo",
  ariaLabelOtro,
  className = "field-lux",
  maxLength = 80,
  required,
  invalid,
  describedBy,
  disabled,
}: Props) {
  // La opción de la lista que corresponde al valor actual, si la hay.
  const enLista = opciones.find((opcion) => normalizar(opcion) === normalizar(value)) ?? null;

  // "Otro…" queda elegido mientras la persona escribe, aunque el campo esté vacío.
  const [otroElegido, setOtroElegido] = useState(false);
  const esOtro = !enLista && (otroElegido || value.trim() !== "");

  const elegir = (elegido: string) => {
    if (elegido === OTRO) {
      setOtroElegido(true);
      onChange("");
      return;
    }
    setOtroElegido(false);
    onChange(elegido);
  };

  return (
    <>
      <select
        id={id}
        name={name}
        value={esOtro ? OTRO : (enLista ?? "")}
        onChange={(evento) => elegir(evento.target.value)}
        required={required && !esOtro}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        className={className}
      >
        {vacio !== undefined ? <option value="">{vacio}</option> : null}
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
        <option value={OTRO}>{etiquetaOtro}</option>
      </select>
      {esOtro ? (
        <input
          id={`${id}-otro`}
          aria-label={ariaLabelOtro ?? "Describe la opción"}
          value={value}
          onChange={(evento) => onChange(evento.target.value)}
          placeholder={placeholderOtro}
          maxLength={maxLength}
          required={required}
          autoComplete="off"
          disabled={disabled}
          // Al elegir "Otro…" lo natural es escribir enseguida.
          autoFocus={otroElegido && value === ""}
          className={`${className} mt-2`}
        />
      ) : null}
    </>
  );
}
