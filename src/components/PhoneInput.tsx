"use client";

/**
 * Campo de teléfono con código de país, el mismo en todo el sitio.
 *
 * A la izquierda el país (bandera y código, Perú por defecto); a la derecha el
 * número. Hacia afuera es un solo valor en formato internacional
 * ("+51 987 654 321"): quien lo usa lo trata como cualquier campo de texto.
 *
 * El selector de país es un `<select>` nativo invisible puesto encima de la
 * bandera: así en el celular abre la lista del sistema, se maneja con teclado
 * y lo anuncia un lector de pantalla, sin tener que escribir un desplegable.
 *
 * Si alguien pega o autocompleta el número entero ("+1 305…"), el país se
 * acomoda solo.
 */

import { Icon } from "@/components/ui/Icon";
import {
  PAISES_TELEFONO,
  banderaDe,
  ejemploDeNumero,
  formatearNumero,
  paisPorIso,
  separarTelefono,
  unirTelefono,
} from "@/lib/telefono";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  /** Teléfono completo, como lo devuelve `onChange`. */
  value: string;
  onChange: (value: string) => void;
  name?: string;
  required?: boolean;
  /** Marca el campo en rojo. El mensaje lo pone quien lo usa. */
  invalid?: boolean;
  "aria-describedby"?: string;
  className?: string;
};

export function PhoneInput({
  id,
  value,
  onChange,
  name,
  required,
  invalid,
  className,
  ...rest
}: Props) {
  const { pais, numero } = separarTelefono(value);

  return (
    <div
      className={cn(
        "field-lux flex items-center !p-0 focus-within:!border-silver-bright focus-within:!bg-surface-3",
        invalid && "!border-danger/60",
        className,
      )}
    >
      <div className="relative flex shrink-0 items-center self-stretch">
        <select
          aria-label="País del teléfono"
          value={pais.iso}
          onChange={(event) => onChange(unirTelefono(paisPorIso(event.target.value), numero) || `+${paisPorIso(event.target.value).codigo} `)}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        >
          {PAISES_TELEFONO.map((opcion) => (
            <option key={opcion.iso} value={opcion.iso}>
              {banderaDe(opcion.iso)} {opcion.nombre} (+{opcion.codigo})
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="flex h-full items-center gap-1.5 rounded-l-[inherit] pl-4 pr-2.5 text-base peer-focus-visible:bg-surface-3 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-silver"
        >
          <span className="text-xl leading-none">{banderaDe(pais.iso)}</span>
          <span className="tabular-nums text-ink-2">+{pais.codigo}</span>
          <Icon name="chevronDown" size={14} className="text-ink-4" />
        </span>
      </div>

      <span aria-hidden="true" className="h-6 w-px shrink-0 bg-line-strong" />

      <input
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={rest["aria-describedby"]}
        value={formatearNumero(pais, numero)}
        onChange={(event) => {
          const escrito = event.target.value;
          // Número entero pegado o autocompletado: se respeta su país.
          if (escrito.trim().startsWith("+") || escrito.trim().startsWith("00")) {
            const pegado = separarTelefono(escrito);
            onChange(unirTelefono(pegado.pais, pegado.numero));
            return;
          }
          onChange(unirTelefono(pais, escrito) || (pais.iso === "PE" ? "" : `+${pais.codigo} `));
        }}
        placeholder={ejemploDeNumero(pais)}
        className="min-w-0 flex-1 self-stretch rounded-r-[inherit] bg-transparent px-3 text-base tabular-nums text-ink placeholder:text-ink-4 focus:outline-none"
      />
    </div>
  );
}
