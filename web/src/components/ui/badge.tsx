import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "brand";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none";

  const variants = {
    default:
      "border-transparent bg-[var(--primary)] text-[var(--primary-foreground)]",
    secondary:
      "border-transparent bg-[var(--secondary)] text-[var(--secondary-foreground)]",
    outline:
      "border border-[var(--border)] text-[var(--foreground)]",
    brand:
      "border-transparent bg-[var(--brand)] text-[var(--brand-foreground)]",
  };

  return (
    <div className={cn(base, variants[variant], className)} {...props} />
  );
}

