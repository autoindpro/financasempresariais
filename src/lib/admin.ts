import { useEffect, useMemo, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "./supabase";

export function useIsPlatformAdmin(): { isAdmin: boolean; loading: boolean } {
  const supabase = useMemo(() => getSupabase(), []);
  const configured = isSupabaseConfigured();
  const [isAdmin, setIsAdmin] = useState(false);
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
        const { data, error } = await supabase.from("app_admins").select("user_id").eq("user_id", userId).maybeSingle();
        if (error) throw error;
        if (!alive) return;
        setIsAdmin(Boolean(data?.user_id));
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
  }, [configured, supabase]);

  return { isAdmin, loading };
}

