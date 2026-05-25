import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "../lib/utils";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

const baseInput =
  "w-full bg-bg-1 border border-line rounded-lg px-3 py-2 text-text font-medium placeholder:text-text-mute focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition";

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, prefix, suffix, className, ...rest }, ref,
) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs uppercase tracking-wider text-text-dim">{label}</span>}
      <span className={cn(
        "relative flex items-center gap-2 bg-bg-1 border border-line rounded-lg pl-3 pr-1 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition",
      )}>
        {prefix && <span className="text-text-mute text-sm shrink-0">{prefix}</span>}
        <input
          ref={ref}
          className={cn("flex-1 bg-transparent border-0 outline-none py-2 text-text placeholder:text-text-mute", className)}
          {...rest}
        />
        {suffix}
      </span>
      {error
        ? <span className="text-xs text-danger">{error}</span>
        : hint && <span className="text-xs text-text-mute">{hint}</span>}
    </label>
  );
});

interface AreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
}
export function FieldArea({ label, hint, className, ...rest }: AreaProps) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs uppercase tracking-wider text-text-dim">{label}</span>}
      <textarea className={cn(baseInput, "font-mono text-sm", className)} {...rest} />
      {hint && <span className="text-xs text-text-mute">{hint}</span>}
    </label>
  );
}
