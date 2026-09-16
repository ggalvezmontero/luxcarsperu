import type { SVGProps } from "react";

/* -----------------------------------------------------------------------------
 * PlaceholderGrafico
 *
 * Tratamiento grafico del sistema de diseno que ocupa el lugar de una foto
 * cuando NO existe una foto honesta para ese contenido.
 *
 * POR QUE EXISTE (no lo borres para "poner una foto bonita"):
 * la auditoria de imagenes encontro stock de Unsplash colocado como si fuera
 * evidencia del servicio: un dashboard de analitica web etiquetado "busqueda de
 * autos", un cambio de aceite etiquetado "inspeccion certificada ASE de 150
 * puntos", y desconocidos de banco de imagenes etiquetados "asesor de LuxCars".
 * A un cliente que va a girar USD 100,000 eso le cuesta credibilidad el dia que
 * lo nota, y ya no la recupera.
 *
 * REGLA: una foto entra al sitio solo si muestra de verdad lo que el texto de
 * al lado afirma. Mientras no exista esa foto va este bloque. Lo que hace falta
 * fotografiar esta listado en docs/IMAGENES.md.
 *
 * Solo tokens del sistema (bg-surface-*, border-line, text-silver*, text-ink-*).
 * Los iconos heredan color con currentColor: cero hex suelto.
 * -------------------------------------------------------------------------- */

type IconoProps = SVGProps<SVGSVGElement>;

function IconoBase({ children, ...props }: IconoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

const ICONOS = {
  busqueda: (props: IconoProps) => (
    <IconoBase {...props}>
      <circle cx="14" cy="14" r="8" />
      <path d="m20 20 6 6" />
      <path d="M10.5 14h7M14 10.5v7" />
    </IconoBase>
  ),
  inspeccion: (props: IconoProps) => (
    <IconoBase {...props}>
      <path d="M11 5h10a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path d="M13 4h6v3h-6z" />
      <path d="m12.5 14 2 2 4.5-4.5" />
      <path d="M12.5 21h7" />
    </IconoBase>
  ),
  asesor: (props: IconoProps) => (
    <IconoBase {...props}>
      <circle cx="16" cy="12" r="4.5" />
      <path d="M7 26a9 9 0 0 1 18 0" />
    </IconoBase>
  ),
  soporte: (props: IconoProps) => (
    <IconoBase {...props}>
      <path d="M6 22V14a10 10 0 0 1 20 0v8" />
      <path d="M26 21v2a4 4 0 0 1-4 4h-4" />
      <rect x="3" y="17" width="5" height="7" rx="2" />
      <rect x="24" y="17" width="5" height="7" rx="2" />
    </IconoBase>
  ),
  vehiculo: (props: IconoProps) => (
    <IconoBase {...props}>
      <path d="M4 18h24l-2.5-7.5A4 4 0 0 0 21.7 8H10.3a4 4 0 0 0-3.8 2.5L4 18Z" />
      <path d="M4 18v4h4v-4M24 18v4h4v-4" />
      <path d="M9 22h14" />
    </IconoBase>
  ),
} as const;

export type IconoPlaceholder = keyof typeof ICONOS;

type Props = {
  /** Que representaria este bloque. Va visible, en versalitas. */
  titulo: string;
  /** Aclaracion honesta de una linea. Opcional. */
  nota?: string;
  icono?: IconoPlaceholder;
  /** Clases de caja (alto/aspect/redondeo) que decide el punto de uso. */
  className?: string;
  /**
   * "completo" = bloque con marco, titulo y nota (reemplaza una foto grande).
   * "marca" = solo el simbolo, para huecos de miniatura donde el texto no entra.
   */
  variante?: "completo" | "marca";
};

export function PlaceholderGrafico({
  titulo,
  nota,
  icono = "vehiculo",
  className = "",
  variante = "completo",
}: Props) {
  const Icono = ICONOS[icono];

  if (variante === "marca") {
    return (
      <div
        role="presentation"
        title={titulo}
        className={`flex items-center justify-center border border-line bg-surface-2 text-silver-dim ${className}`}
      >
        <Icono className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div
      // Decorativo: el texto que lo acompana ya explica el contenido, asi que
      // no aporta nada al lector de pantalla y si ruido.
      role="presentation"
      className={`relative flex flex-col items-center justify-center gap-3 overflow-hidden border border-line bg-surface-2 px-5 py-8 text-center ${className}`}
    >
      {/* Marco interior de una sola hairline plateada: mismo gesto que el resto
          del sistema (SectionHeading, tarjetas de proceso). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-3 border border-line"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-3 h-px w-10 bg-silver-dim"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-3 right-3 h-px w-10 bg-silver-dim"
      />

      <span className="relative flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface-3 text-silver-dim">
        <Icono className="h-5 w-5" />
      </span>

      <span className="relative text-[0.625rem] font-medium uppercase leading-tight tracking-[0.28em] text-silver-dim">
        {titulo}
      </span>

      {nota ? (
        <span className="relative max-w-[28ch] text-xs leading-relaxed text-ink-4">
          {nota}
        </span>
      ) : null}
    </div>
  );
}
