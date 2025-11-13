import Link from "next/link";
import { cn } from "@/lib/utils";
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
  "inline-flex items-center justify-center rounded-full font-semibold tracking-wide transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70 focus-visible:ring-offset-black";

const variants = {
  primary:
    "bg-gradient-to-r from-[#d4af37] via-[#f5d072] to-[#b68b2d] text-black shadow-[0_0_25px_rgba(245,208,114,0.35)] hover:shadow-[0_0_40px_rgba(245,208,114,0.55)] hover:from-[#f2c86a] hover:to-[#d4af37]",
  secondary:
    "border border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/30",
  ghost: "text-white/80 hover:text-white hover:bg-white/5",
};

const sizes = {
  md: "px-6 py-2 text-sm",
  lg: "px-7 py-3 text-base",
};

export function Button(props: ButtonProps | LinkProps) {
  const { variant = "primary", size = "md", className, children, ...rest } =
    props;

  if ("href" in rest && rest.href) {
    return (
      <Link
        {...rest}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      {...rest}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
    >
      {children}
    </button>
  );
}
