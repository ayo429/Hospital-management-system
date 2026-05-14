import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

// Moved outside component — retries up to 3 times with backoff
async function fetchProfile(userId) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, organisations(id, name)")
        .eq("id", userId)
        .single();

      if (error) throw new Error(error.message);
      if (data) {
        console.log("profile loaded on attempt", attempt, data);
        return data;
      }
    } catch (err) {
      console.warn(`fetchProfile attempt ${attempt} failed:`, err.message);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  console.error("fetchProfile failed after 3 attempts");
  return null;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session?.user) {
        setSession(session);
        const p = await fetchProfile(session.user.id);
        if (mounted) setProfile(p);
      } else {
        setSession(null);
      }
      if (mounted) setLoading(false);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log("auth event:", event);

      if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event === "SIGNED_IN") {
        setSession(session);
        const p = await fetchProfile(session.user.id);
        if (mounted) {
          setProfile(p);
          setLoading(false);
        }
        return;
      }

      // TOKEN_REFRESHED — just update session, don't re-fetch profile
      if (event === "TOKEN_REFRESHED") {
        return; // do nothing, session is still valid
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  const value = {
    session,
    profile,
    loading,
    signOut,
    isOwner: profile?.role === "owner",
    isAdmin: ["owner", "admin"].includes(profile?.role),
    isDoctor: profile?.role === "doctor",
    isNurse: profile?.role === "nurse",
    isPharmacist: profile?.role === "pharmacist",
    isAccountant: profile?.role === "accountant",
    orgId: profile?.org_id,
    org: profile?.organisations,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
