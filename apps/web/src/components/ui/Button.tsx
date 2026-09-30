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
    "inline-flex items-center justify-center font-heading tracking-tight select-none cursor-pointer rounded-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--zcash-gold)] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none transition-palette";

  const variants: Record<ButtonVariant, string> = {
    // Primary: Solid cypherpunk Zcash gold button with white text
    primary:
      "bg-[var(--zcash-gold)] hover:bg-[var(--zcash-gold-hover)] text-[#080b11] font-bold border border-[var(--zcash-gold)]",
    
    // Outline: Adapts to Light (dark text & slate border) and Dark (white text & translucent white border)
    outline:
      "border border-[var(--border-strong)] bg-transparent hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] font-medium",

    secondary:
      "border border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] font-medium",

    ghost:
      "border border-transparent bg-transparent hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] font-medium",
    
    // Danger: Red alert action adapting to light/dark
    danger:
      "border border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)] font-semibold",

    success:
      "border border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)] font-semibold",

    accent:
      "border border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info)] font-semibold",
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
