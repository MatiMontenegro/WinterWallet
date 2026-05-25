// Generic utilities used across the UI.

export function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(" ");
}

export function shortAddress(addr: string | null | undefined, head = 6, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function fmtNumber(n: number | string, max = 6): string {
  const num = Number(n);
  if (!Number.isFinite(num) || num === 0) return "0";
  if (Math.abs(num) < 1e-6) return num.toExponential(2);
  return num.toLocaleString(undefined, { maximumFractionDigits: max });
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Detect iOS Safari so we can show the right "Add to Home Screen" tutorial. */
export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  // iPadOS 13+ UA looks like macOS, but `maxTouchPoints > 1` reveals it.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS specific
  if ((window.navigator as unknown as { standalone?: boolean }).standalone) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}
