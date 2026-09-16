import { cn } from "@/lib/utils";
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type BaseProps = {
  /**
   * `accent` es la variante en oro: como máximo una por pantalla.
   * Ante la duda, usar `primary` (plata).
   */
  variant?: "primary" | "secondary" | "ghost" | "accent";
  size?: "md" | "lg";
  className?: string;
};

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type LinkProps = BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/**
 * El foco visible se resuelve globalmente en globals.css: aquí no se
 * redefine ni se anula con outline-none.
 */
const baseStyles =
  "inline-flex max-w-full items-center justify-center gap-2 rounded-full text-center font-medium uppercase leading-none tracking-[0.16em] transition-colors duration-200 ease-out disabled:pointer-events-none disabled:opacity-45";

const variants = {
  /* Plata: el acento dominante del sistema. */
  primary: "bg-silver text-void hover:bg-silver-bright",
  /* Control delineado sobre fondo oscuro. */
  secondary:
    "border border-line-strong bg-transparent text-ink hover:border-silver hover:bg-surface-2",
  /* Acción terciaria, sin peso visual. */
  ghost: "text-ink-2 hover:bg-surface hover:text-ink",
  /* Oro: reservado a un único CTA por pantalla. */
  accent: "bg-gold text-void hover:bg-gold-bright",
};

const sizes = {
  md: "min-h-11 px-6 py-3 text-xs",
  lg: "min-h-12 px-7 py-3.5 text-sm sm:px-8",
};

export function Button(props: ButtonProps | LinkProps) {
  const { variant = "primary", size = "md", className, children, ...rest } =
    props;
  const classes = cn(baseStyles, variants[variant], sizes[size], className);

  if ("href" in props && props.href) {
    // TypeScript now knows this is LinkProps
    const linkProps = rest as Omit<LinkProps, "variant" | "size" | "className" | "children">;
    return (
      <Link {...linkProps} className={classes}>
        {children}
      </Link>
    );
  }

  // TypeScript now knows this is ButtonProps
  const buttonProps = rest as Omit<ButtonProps, "variant" | "size" | "className" | "children">;
  return (
    <button {...buttonProps} className={classes}>
      {children}
    </button>
  );
}
