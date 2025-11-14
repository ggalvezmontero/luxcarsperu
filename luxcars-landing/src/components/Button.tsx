import Link from "next/link";
import { motion } from "framer-motion";
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
  "inline-flex items-center justify-center rounded-full font-medium tracking-[0.08em] uppercase transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70 focus-visible:ring-offset-black";

const variants = {
    primary:
      "bg-gradient-to-r from-[#d7b977] via-[#f1d387] to-[#d7b977] text-[#0f0f0f] shadow-[0_10px_45px_rgba(241,211,135,0.35)] hover:shadow-[0_14px_55px_rgba(241,211,135,0.55)]",
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
  const motionProps = {
    whileHover: { y: -1, scale: 1.015 },
    whileTap: { scale: 0.97 },
    transition: { type: "spring", stiffness: 320, damping: 20 },
  };

  if ("href" in rest && rest.href) {
    return (
      <motion.div className="inline-flex" {...motionProps}>
        <Link {...rest} className={classes}>
          {children}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button {...rest} className={classes} {...motionProps}>
      {children}
    </motion.button>
  );
}
