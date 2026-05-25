import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "../lib/utils";

type ToastKind = "ok" | "warn" | "info";
interface Toast { id: number; message: string; kind: ToastKind }

const Ctx = createContext<{ push: (msg: string, kind?: ToastKind, ms?: number) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: ToastKind = "info", ms = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, ms);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div
        className="fixed right-4 z-[200] flex flex-col gap-2 pointer-events-none"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto max-w-sm rounded-lg border bg-bg-2 px-4 py-2 text-sm shadow-2xl animate-fade-up",
              t.kind === "ok" && "border-accent/50",
              t.kind === "warn" && "border-danger/60 text-danger",
              t.kind === "info" && "border-info/50",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx.push;
}
