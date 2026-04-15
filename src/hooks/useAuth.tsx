import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { saveOneSignalPlayerIdForUser } from "@/lib/pushNotifications";

interface AuthContext {
  user: User | null;
  session: Session | null;
  role: string | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, role: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContext | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    const nextRole = data?.role ?? null;
    setRole(nextRole);
    return nextRole;
  };

  const handleStaleRefreshToken = async () => {
    // Clear invalid local auth state to avoid repeated refresh-token errors.
    await supabase.auth.signOut({ scope: "local" });
    setSession(null);
    setUser(null);
    setRole(null);
  };

  useEffect(() => {
    let active = true;
    const loadingTimeout = window.setTimeout(() => {
      if (!active) return;
      setLoading(false);
    }, 4000);

    const hydrateSession = async (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await fetchRole(nextSession.user.id);
        setTimeout(() => {
          void saveOneSignalPlayerIdForUser(nextSession.user!.id);
        }, 1200);
      } else {
        setRole(null);
      }

      if (active) {
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void hydrateSession(nextSession);
    });

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error && /refresh token/i.test(error.message)) {
        await handleStaleRefreshToken();
        if (active) setLoading(false);
        return;
      }
      await hydrateSession(session ?? null);
    });

    return () => {
      active = false;
      window.clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, name: string, role: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { error };

    // Check if user is blocked before letting them in
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_blocked")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile?.is_blocked) {
      await supabase.auth.signOut();
      return {
        error: {
          message: "Your account has been blocked by admin. Please contact support.",
        },
      };
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
