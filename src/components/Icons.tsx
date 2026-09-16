import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/* Los iconos heredan el color del contexto: cada punto de uso decide con un
   token (text-silver, text-ink-3, ...). Sin color propio no hay hex suelto. */
const DEFAULT_COLOR = "currentColor";

export function VehicleIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={DEFAULT_COLOR}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 13h18l-2-6a3 3 0 0 0-2.846-2H7.846A3 3 0 0 0 5 7l-2 6Z" />
      <path d="M5 17a2 2 0 1 0 4 0" />
      <path d="M15 17a2 2 0 1 0 4 0" />
      <path d="M5 17h14" />
    </svg>
  );
}

export function TaxIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={DEFAULT_COLOR}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6" />
      <path d="M9 10V9a1 1 0 0 1 1-1h1" />
      <path d="M15 14v1a1 1 0 0 1-1 1h-1" />
    </svg>
  );
}

export function InfoIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={DEFAULT_COLOR}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function MoneyIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={DEFAULT_COLOR}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M12 9v6" />
      <path d="M9.5 10.5A2.5 2.5 0 0 1 12 9a2.5 2.5 0 0 1 2.5 1.5" />
      <path d="M14.5 13.5A2.5 2.5 0 0 1 12 15a2.5 2.5 0 0 1-2.5-1.5" />
    </svg>
  );
}

export function ServiceIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={DEFAULT_COLOR}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  );
}
