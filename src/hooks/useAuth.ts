// Supabase auth state, exposed as a tiny React store via useSyncExternalStore.

import { useSyncExternalStore, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseEnabled } from "../lib/supabase";

let currentSession: Session | null = null;
let initialized = false;
const subs = new Set<() => void>();

function notify() {
  for (const fn of subs) fn();
}

function ensureInit() {
  if (initialized || !isSupabaseEnabled) return;
  initialized = true;
  const sb = getSupabase();
  if (!sb) return;
  sb.auth.getSession().then(({ data }) => {
    currentSession = data.session;
    notify();
  });
  sb.auth.onAuthStateChange((_evt, session) => {
    currentSession = session;
    notify();
  });
}

export function useAuth() {
  ensureInit();

  const subscribe = useCallback((cb: () => void) => {
    subs.add(cb);
    return () => {
      subs.delete(cb);
    };
  }, []);

  const session = useSyncExternalStore(
    subscribe,
    () => currentSession,
    () => null,
  );

  return {
    session,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session?.user),
    enabled: isSupabaseEnabled,
  };
}

export async function signOut() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}
