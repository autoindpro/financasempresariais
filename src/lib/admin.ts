import { useEffect, useMemo, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "./supabase";

const LS_ADMIN_USER = "flux_platform_admin_user";
const LS_ADMIN_FLAG = "flux_platform_admin";

function loadCachedAdmin(): { userId: string | null; isAdmin: boolean | null } {
  try {
    const userId = localStorage.getItem(LS_ADMIN_USER);
    const raw = localStorage.getItem(LS_ADMIN_FLAG);
    if (raw !== "true" && raw !== "false") return { userId: userId ?? null, isAdmin: null };
    return { userId: userId ?? null, isAdmin: raw === "true" };
  } catch {
    return { userId: null, isAdmin: null };
  }
}

function saveCachedAdmin(userId: string, isAdmin: boolean) {
  try {
    localStorage.setItem(LS_ADMIN_USER, userId);
    localStorage.setItem(LS_ADMIN_FLAG, isAdmin ? "true" : "false");
  } catch {
    // ignore
  }
}

export function useIsPlatformAdmin(): { isAdmin: boolean; loading: boolean } {
  const supabase = useMemo(() => getSupabase(), []);
  const configured = isSupabaseConfigured();
  const cached = useMemo(() => (typeof window === "undefined" ? { userId: null, isAdmin: null } : loadCachedAdmin()), []);
  const [isAdmin, setIsAdmin] = useState(Boolean(cached.isAdmin));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        if (!configured || !supabase) {
          if (!alive) return;
          setIsAdmin(false);
          setLoading(false);
          return;
        }
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) {
          if (!alive) return;
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        // Keep UI stable: if we have a cached value for this user, keep it while we refresh.
        if (cached.userId === userId && typeof cached.isAdmin === "boolean") {
          setIsAdmin(cached.isAdmin);
        }

        const { data, error } = await supabase.from("app_admins").select("user_id").eq("user_id", userId).maybeSingle();
        if (error) throw error;
        if (!alive) return;
        const next = Boolean(data?.user_id);
        setIsAdmin(next);
        saveCachedAdmin(userId, next);
        setLoading(false);
      } catch {
        if (!alive) return;
        setIsAdmin(false);
        setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [cached.isAdmin, cached.userId, configured, supabase]);

  return { isAdmin, loading };
}
