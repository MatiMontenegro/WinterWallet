import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/utils";

type Variant = "primary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-[#0a1424] hover:bg-accent-strong active:scale-[.98] font-semibold shadow-[0_4px_18px_-4px_rgba(124,247,200,0.5)]",
  ghost: "bg-transparent border border-line-strong text-text hover:bg-white/5",
  danger:
    "bg-danger text-[#0a1424] hover:brightness-110 active:scale-[.98] font-semibold",
  soft: "bg-bg-3 text-text hover:bg-[#2c3460]",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-md",
  md: "h-10 px-4 text-sm rounded-lg",
  lg: "h-12 px-5 text-base rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, block, className, children, disabled, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed select-none",
        "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
        VARIANTS[variant],
        SIZES[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"
        />
      )}
      {children}
    </button>
  );
});
