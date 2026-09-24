"use client";

import React, { forwardRef } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export type ButtonVariant =
  | "primary"
  | "outline"
  | "secondary"
  | "ghost"
  | "danger"
  | "success"
  | "accent";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export interface ButtonAsButtonProps
  extends ButtonBaseProps,
    React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: undefined;
}

export interface ButtonAsLinkProps
  extends ButtonBaseProps,
    React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

export function buttonVariants({
  variant = "outline",
  size = "md",
  fullWidth = false,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}) {
  // Base classes: strictly boxy (rounded-none), sharp crisp borders, modern typography
  const base =
    "inline-flex items-center justify-center font-heading tracking-tight select-none cursor-pointer transition-all duration-150 rounded-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--zcash-gold)] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

  const variants: Record<ButtonVariant, string> = {
    // Primary: Solid cypherpunk Zcash gold button with white text
    primary:
      "bg-[var(--zcash-gold)] hover:bg-[var(--zcash-gold-hover)] text-white font-bold border border-[var(--zcash-gold)] shadow-xs hover:shadow-amber-500/20 active:bg-[var(--zcash-gold-hover)]",
    
    // Outline: Adapts to Light (dark text & slate border) and Dark (white text & translucent white border)
    outline:
      "border border-slate-300 dark:border-white/20 bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-400 dark:hover:border-white/40 text-slate-900 dark:text-white font-medium",
    
    // Secondary: Filled card surface adapting to light/dark backgrounds
    secondary:
      "border border-slate-200 dark:border-[var(--border-default)] bg-slate-100 dark:bg-[var(--bg-secondary)] hover:bg-slate-200/80 dark:hover:bg-[var(--bg-surface-hover)] hover:border-slate-300 dark:hover:border-[var(--border-strong)] text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white font-medium",
    
    // Ghost: Transparent borderless button adapting to light/dark hover
    ghost:
      "border border-transparent bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white font-medium",
    
    // Danger: Red alert action adapting to light/dark
    danger:
      "border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-semibold",
    
    // Success: Green confirmation action adapting to light/dark
    success:
      "border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold",
    
    // Accent: Electric cyan/sky accent adapting to light/dark
    accent:
      "border border-sky-200 dark:border-[#38BDF8]/40 bg-sky-50 dark:bg-[#38BDF8]/15 hover:bg-sky-100 dark:hover:bg-[#38BDF8]/25 text-sky-700 dark:text-[#38BDF8] font-semibold",
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm gap-2",
    lg: "px-6 py-3 text-sm sm:text-base gap-2.5",
    icon: "p-2 sm:p-2.5 aspect-square",
  };

  const width = fullWidth ? "w-full" : "";

  return [base, variants[variant], sizes[size], width, className]
    .filter(Boolean)
    .join(" ");
}

export const Button = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps
>(function Button(props, ref) {
  const {
    variant = "outline",
    size = "md",
    icon,
    iconRight,
    isLoading = false,
    fullWidth = false,
    className = "",
    children,
    ...rest
  } = props;

  const classes = buttonVariants({ variant, size, fullWidth, className });

  const content = (
    <>
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0 flex items-center">{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!isLoading && iconRight && (
        <span className="shrink-0 flex items-center">{iconRight}</span>
      )}
    </>
  );

  // If href is specified, render either Next.js Link or native <a>
  if ("href" in props && typeof props.href === "string") {
    const isExternal =
      props.href.startsWith("http://") ||
      props.href.startsWith("https://") ||
      props.href.startsWith("mailto:");

    if (isExternal) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={props.href}
          className={classes}
          target={props.target ?? "_blank"}
          rel={props.rel ?? "noopener noreferrer"}
          {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={props.href}
        className={classes}
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={(rest as React.ButtonHTMLAttributes<HTMLButtonElement>).type || "button"}
      disabled={isLoading || (rest as React.ButtonHTMLAttributes<HTMLButtonElement>).disabled}
      className={classes}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {content}
    </button>
  );
});

Button.displayName = "Button";
