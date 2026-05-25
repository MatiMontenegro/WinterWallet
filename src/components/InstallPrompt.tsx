// iOS-specific "Add to Home Screen" hint.
// Safari does not fire `beforeinstallprompt`, so we render manual instructions
// for iPhone users on first visit. Dismissed prompts are remembered locally.

import { useEffect, useState } from "react";
import { isIOS, isStandalone } from "../lib/utils";
import { Button } from "./Button";

const DISMISS_KEY = "ww:install-dismissed-at";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOS() || isStandalone()) return;
    const last = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (Date.now() - last < COOLDOWN_MS) return;
    const t = window.setTimeout(() => setShow(true), 2000);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  }

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-40 max-w-sm w-[calc(100%-2rem)] card-glass p-4 animate-fade-up"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      role="dialog"
      aria-label="Install on iPhone"
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl" aria-hidden>📱</div>
        <div className="flex-1 text-sm">
          <p className="font-semibold text-text">Install WinterWallet</p>
          <p className="text-text-dim mt-1">
            Tap <span className="inline-block px-1 rounded bg-bg-3">⇪</span> in Safari, then <strong>Add to Home Screen</strong>.
            Opens like a native app — fullscreen, with its own icon.
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button variant="ghost" size="sm" onClick={dismiss}>Got it</Button>
      </div>
    </div>
  );
}
