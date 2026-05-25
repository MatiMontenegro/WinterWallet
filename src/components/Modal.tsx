import { useEffect, type ReactNode } from "react";
import { cn } from "../lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  size?: "sm" | "md";
}

export function Modal({ open, onClose, title, children, actions, size = "md" }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[180] grid place-items-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={cn(
          "card-glass w-full p-6",
          size === "sm" ? "max-w-sm" : "max-w-md",
          "animate-fade-up",
        )}
      >
        <h3 id="modal-title" className="text-lg font-semibold text-text">
          {title}
        </h3>
        <div className="mt-3 text-sm text-text">{children}</div>
        {actions && <div className="mt-5 flex justify-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}
