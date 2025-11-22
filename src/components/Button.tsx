import { cn } from "@/lib/utils";
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type BaseProps = {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
  className?: string;
};

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type LinkProps = BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

const baseStyles =
  "inline-flex items-center justify-center rounded-full font-medium tracking-[0.08em] uppercase transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70 focus-visible:ring-offset-black hover:-translate-y-0.5 hover:scale-[1.015] active:scale-[0.97]";

const variants = {
  primary:
    "bg-white text-black shadow-[0_10px_45px_rgba(255,255,255,0.25)] hover:shadow-[0_14px_55px_rgba(255,255,255,0.35)] hover:bg-white/95",
  secondary:
    "border border-white/25 bg-white/10 text-white hover:bg-white/20 hover:border-white/40",
  ghost: "text-white/80 hover:text-white hover:bg-white/5",
};

const sizes = {
  md: "px-6 py-2 text-sm",
  lg: "px-7 py-3 text-base",
};

export function Button(props: ButtonProps | LinkProps) {
  const { variant = "primary", size = "md", className, children, ...rest } =
    props;
  const classes = cn(baseStyles, variants[variant], sizes[size], className);

  if ("href" in rest && rest.href) {
    const { onClick, ...linkProps } = rest;
    return (
      <Link {...linkProps} className={classes} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button {...rest} className={classes}>
      {children}
    </button>
  );
}
