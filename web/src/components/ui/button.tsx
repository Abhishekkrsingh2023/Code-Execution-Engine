import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "brand" | "outline" | "secondary" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none";

    const variants = {
      default:
        "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 shadow-xs",
      brand:
        "bg-[var(--brand)] text-[var(--brand-foreground)] hover:opacity-90 shadow-xs font-semibold",
      outline:
        "border border-[var(--border)] bg-transparent hover:bg-[var(--accent)] text-[var(--foreground)]",
      secondary:
        "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--accent)]",
      ghost:
        "hover:bg-[var(--accent)] text-[var(--foreground)]",
      destructive:
        "bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-90 shadow-xs",
    };

    const sizes = {
      default: "h-9 px-4 py-2",
      sm: "h-8 px-3 text-xs",
      lg: "h-10 px-6 text-sm",
      icon: "h-8 w-8 p-0",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

