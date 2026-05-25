import { useEffect, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";

export type AuthStatus =
  | { mode: "local" }
  | { mode: "supabase"; state: "loading"; email: null }
  | { mode: "supabase"; state: "logged_out"; email: null }
  | { mode: "supabase"; state: "logged_in"; email: string };

function getClient(): SupabaseClient | null {
  return getSupabase();
}

export function useAuthStatus(): {
  status: AuthStatus;
  loading: boolean;
  supabase: SupabaseClient | null;
  signOut: () => Promise<void>;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getClient();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (!active) return;
        setSession(data.session ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setLoading(false);
      });

    const sub = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.data.subscription.unsubscribe();
    };
  }, [supabase]);

  const configured = isSupabaseConfigured();
  const status: AuthStatus = !configured
    ? { mode: "local" }
    : !supabase
      ? { mode: "supabase", state: "loading", email: null }
      : session?.user?.email
        ? { mode: "supabase", state: "logged_in", email: session.user.email }
        : { mode: "supabase", state: "logged_out", email: null };

  return {
    status,
    loading: configured ? loading : false,
    supabase,
    signOut: async () => {
      if (!supabase) return;
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  };
}
