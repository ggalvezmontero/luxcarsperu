import { cn } from "@/lib/utils";
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type BaseProps = {
  /**
   * `accent` es la variante en oro: como máximo una por pantalla.
   * `whatsapp` es el verde oficial, solo para enlaces a wa.me.
   */
  variant?: "primary" | "secondary" | "ghost" | "accent" | "whatsapp";
  size?: "sm" | "md" | "lg";
  className?: string;
};

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type LinkProps = BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

const baseStyles =
  "inline-flex max-w-full shrink-0 items-center justify-center gap-2 rounded-full text-center font-semibold leading-none tracking-[0.01em] transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]";

const variants = {
  primary: "bg-ink text-void hover:bg-silver-bright shadow-[0_8px_24px_rgba(255,255,255,0.08)]",
  secondary:
    "border border-line-strong bg-transparent text-ink hover:border-silver hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  /* Cromado: degradado plateado metálico. Es el CTA principal del sitio. */
  accent:
    "bg-[linear-gradient(180deg,#FFFFFF_0%,#D9D9DE_45%,#A9A9B1_100%)] text-void ring-1 ring-white/60 ring-inset shadow-[0_10px_30px_rgba(192,192,192,0.22)] hover:bg-[linear-gradient(180deg,#FFFFFF_0%,#E8E8EC_45%,#BEBEC6_100%)]",
  whatsapp: "bg-whatsapp text-void hover:brightness-110 shadow-[0_8px_28px_rgba(37,211,102,0.2)]",
};

const sizes = {
  sm: "min-h-9 px-4 text-xs",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-13 px-7 text-[15px]",
};

export function Button(props: ButtonProps | LinkProps) {
  const { variant = "primary", size = "md", className, children, ...rest } =
    props;
  const classes = cn(baseStyles, variants[variant], sizes[size], className);

  if ("href" in props && props.href) {
    const linkProps = rest as Omit<
      LinkProps,
      "variant" | "size" | "className" | "children"
    >;
    const external = /^https?:/.test(props.href);
    return (
      <Link
        {...linkProps}
        target={external ? "_blank" : linkProps.target}
        rel={external ? "noopener noreferrer" : linkProps.rel}
        className={classes}
      >
        {children}
      </Link>
    );
  }

  const buttonProps = rest as Omit<
    ButtonProps,
    "variant" | "size" | "className" | "children"
  >;
  return (
    <button type="button" {...buttonProps} className={classes}>
      {children}
    </button>
  );
}
