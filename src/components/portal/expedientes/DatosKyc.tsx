"use client";

/**
 * Controles del Anexo C que el portal pide en la etapa de contrato (28 nov
 * 2026): la respuesta PEP del representante con su cargo, el origen de los
 * fondos con su detalle y los beneficiarios finales, uno por fila. Los usan la
 * ficha del cliente (`ClienteForm`) y el panel "Datos que faltan para esta
 * etapa y la siguiente". Lo que guardan es lo que el anexo imprime: nada de
 * casillas ni líneas para llenar a mano.
 */

import { Button } from "@/components/Button";
import { ORIGEN_FONDOS_LABEL, beneficiarioCompleto } from "@/core/expedientes/campos";
import type { Beneficiario, OrigenFondos } from "@/core/expedientes/tipos";
import { ORIGENES_FONDOS } from "@/core/expedientes/tipos";
import { Entrada, Selector } from "./Formulario";

/** PEP sin declarar (`null`), no o sí; con "sí" pide el cargo. */
export function ControlPep({
  esPep,
  cargo,
  onCambio,
}: {
  esPep: boolean | null;
  cargo: string;
  onCambio: (esPep: boolean | null, cargo: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Selector
        value={esPep === null ? "" : esPep ? "si" : "no"}
        onChange={(e) => onCambio(e.target.value === "" ? null : e.target.value === "si", cargo)}
        aria-label="¿El representante es PEP?"
      >
        <option value="">Sin declarar</option>
        <option value="no">No es PEP</option>
        <option value="si">Sí es PEP (o pariente o asociado cercano)</option>
      </Selector>
      {esPep ? (
        <Entrada value={cargo} onChange={(e) => onCambio(true, e.target.value)} maxLength={160} placeholder="Cargo público, entidad y fechas" aria-label="Cargo que lo hace PEP" />
      ) : null}
    </div>
  );
}

/** Categoría del origen de los fondos y su detalle (de qué utilidades, qué préstamo, qué activo…). */
export function ControlOrigenFondos({
  tipo,
  detalle,
  onCambio,
}: {
  tipo: OrigenFondos | null;
  detalle: string;
  onCambio: (tipo: OrigenFondos | null, detalle: string) => void;
}) {
  const ayuda: Record<OrigenFondos, string> = {
    utilidades: "ej. Utilidades acumuladas 2025 según estados financieros",
    prestamo: "ej. Préstamo vehicular del BCP n.º 123-456",
    aporte_capital: "ej. Aporte de los socios del 10 de noviembre de 2026",
    venta_activo: "ej. Venta del camión placa ABC-123",
    otro: "Describe el origen",
  };
  return (
    <div className="space-y-2">
      <Selector value={tipo ?? ""} onChange={(e) => onCambio((e.target.value || null) as OrigenFondos | null, detalle)} aria-label="Origen de los fondos">
        <option value="">— Elegir —</option>
        {ORIGENES_FONDOS.map((o) => (
          <option key={o} value={o}>{ORIGEN_FONDOS_LABEL[o]}</option>
        ))}
      </Selector>
      <Entrada value={detalle} onChange={(e) => onCambio(tipo, e.target.value)} maxLength={500} placeholder={tipo ? ayuda[tipo] : "Detalle del origen"} aria-label="Detalle del origen de los fondos" />
    </div>
  );
}

const VACIO: Beneficiario = { nombre: "", documento: "", porcentaje: 0, pep: false };

/** Beneficiarios finales: una fila por persona con nombre, documento, participación y PEP. */
export function EditorBeneficiarios({ valor, onCambio }: { valor: Beneficiario[]; onCambio: (lista: Beneficiario[]) => void }) {
  const filas = valor.length ? valor : [VACIO];
  const cambiar = (i: number, cambios: Partial<Beneficiario>) => onCambio(filas.map((b, j) => (j === i ? { ...b, ...cambios } : b)));
  const suma = filas.reduce((s, b) => s + (Number.isFinite(b.porcentaje) ? b.porcentaje : 0), 0);
  const incompletos = filas.filter((b) => !beneficiarioCompleto(b)).length;
  return (
    <div className="space-y-2">
      {filas.map((b, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_5.5rem_auto_auto] sm:items-center">
          <Entrada value={b.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} maxLength={160} placeholder="Nombre completo" aria-label={`Beneficiario ${i + 1}: nombre`} />
          <Entrada value={b.documento} onChange={(e) => cambiar(i, { documento: e.target.value })} maxLength={40} placeholder="DNI 0XXXXXXX o pasaporte" aria-label={`Beneficiario ${i + 1}: documento`} />
          <Entrada
            inputMode="decimal"
            value={b.porcentaje ? String(b.porcentaje) : ""}
            onChange={(e) => cambiar(i, { porcentaje: Number(e.target.value.replace(",", ".")) || 0 })}
            placeholder="%"
            aria-label={`Beneficiario ${i + 1}: participación en %`}
          />
          <label className="flex items-center gap-2 text-xs text-ink-2">
            <input type="checkbox" checked={b.pep} onChange={(e) => cambiar(i, { pep: e.target.checked })} className="h-4 w-4 accent-silver" />
            PEP
          </label>
          <Button type="button" size="sm" variant="ghost" className="border border-line" disabled={filas.length === 1} onClick={() => onCambio(filas.filter((_, j) => j !== i))}>
            Quitar
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="secondary" disabled={filas.length >= 10} onClick={() => onCambio([...filas, VACIO])}>
          Agregar beneficiario
        </Button>
        <span className={`text-xs ${suma > 100 || incompletos ? "text-warn" : "text-ink-4"}`}>
          Suma {Number(suma.toFixed(2))} %{incompletos ? ` · ${incompletos === 1 ? "una fila incompleta" : `${incompletos} filas incompletas`} (nombre, documento y participación mayor que 0)` : ""}{suma > 100 ? " · no puede pasar de 100 %" : ""}
        </span>
      </div>
    </div>
  );
}

/** Lo que se guarda: solo las filas con algo escrito; `null` si no queda ninguna. */
export function beneficiariosParaGuardar(lista: Beneficiario[]): Beneficiario[] | null {
  const limpias = lista
    .map((b) => ({ nombre: b.nombre.trim(), documento: b.documento.trim(), porcentaje: Number.isFinite(b.porcentaje) ? b.porcentaje : 0, pep: b.pep }))
    .filter((b) => b.nombre || b.documento || b.porcentaje);
  return limpias.length ? limpias : null;
}
