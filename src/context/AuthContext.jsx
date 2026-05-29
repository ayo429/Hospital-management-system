import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

// ── Branded loading screen (shown by React after it mounts) ──────────────────
export function LoadingScreen() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        background: "#0f1e3d",
        zIndex: 9998,
      }}
    >
      <style>{`
        @keyframes medcore-pulse {
          0%, 100% { transform: scale(1);   opacity: 1; }
          50%       { transform: scale(1.2); opacity: 0.75; }
        }
        @keyframes medcore-fade-in {
          to { opacity: 1; }
        }
        .mc-loader-icon {
          font-size: 52px;
          line-height: 1;
          animation: medcore-pulse 1.4s ease-in-out infinite;
          transform-origin: center;
        }
        .mc-loader-wordmark {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.3px;
          opacity: 0;
          animation: medcore-fade-in 0.5s ease forwards 0.2s;
        }
        .mc-loader-sub {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #06b6d4;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          opacity: 0;
          animation: medcore-fade-in 0.5s ease forwards 0.4s;
        }
      `}</style>
      <div className="mc-loader-icon">🏥</div>
      <div className="mc-loader-wordmark">MedCore HMS</div>
      <div className="mc-loader-sub">Loading…</div>
    </div>
  );
}

// ── Fade out the static HTML loader once React has mounted ───────────────────
function dismissHtmlLoader() {
  const el = document.getElementById("root-loader");
  if (!el) return;
  el.classList.add("fade-out");
  setTimeout(() => el.remove(), 350);
}

// ── Profile fetcher ──────────────────────────────────────────────────────────
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

// ── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Dismiss the static HTML loader as soon as the React tree mounts
  useEffect(() => {
    dismissHtmlLoader();
  }, []);

  useEffect(() => {
    let mounted = true;
    let initDone = false;

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
        setProfile(null);
      }

      if (mounted) {
        setLoading(false);
        initDone = true;
      }
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log("auth event:", event);

      // Handle both SIGNED_IN and INITIAL_SESSION the same way
      if (
        (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
        session?.user
      ) {
        if (!initDone) return; // still being handled by init()
        setSession(session);
        setLoading(true);
        const p = await fetchProfile(session.user.id);
        if (mounted) {
          setProfile(p);
          setLoading(false);
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event === "TOKEN_REFRESHED" && session) {
        setSession(session);
        return;
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

  // While loading, show the branded React loading screen
  // (the HTML loader has already been dismissed at this point)
  if (loading) return <LoadingScreen />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
