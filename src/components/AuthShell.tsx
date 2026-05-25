import type { ReactNode } from "react";

export function AuthShell({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <main className="min-h-dvh flex items-center justify-center px-5 py-10 relative overflow-hidden">
      {/* Decorative orbs — pure CSS, no images */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-32 h-96 w-96 rounded-full bg-accent/15 blur-3xl animate-pulse-slow" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-info/15 blur-3xl animate-pulse-slow" />
      <div aria-hidden className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-accent/5 blur-2xl" />

      <div className="relative z-10 w-full max-w-md flex flex-col gap-7 animate-fade-up">
        <header className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">WinterWallet</h1>
            <p className="text-text-dim text-sm">{subtitle ?? "Real Web3, in your pocket."}</p>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

export function Logo() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-accent/40 blur-xl rounded-2xl animate-pulse-slow" aria-hidden />
      <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-accent to-info grid place-items-center text-[#0b0d18] text-2xl font-bold shadow-glass animate-float">
        ❄
      </div>
    </div>
  );
}
