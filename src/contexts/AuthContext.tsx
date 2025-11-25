import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import type { Session, User } from "@supabase/supabase-js";
import type { Profile } from "../types";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // -------------------------------------------------------------------
  // GET PROFILE — dibuat fungsi terpisah agar aman dari race-condition
  // -------------------------------------------------------------------
  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) return null;
    return data ?? null;
  };

  // -------------------------------------------------------------------
  // LOAD INITIAL SESSION — hanya dijalankan sekali
  // -------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      const current = data.session;

      if (!mounted) return;

      setSession(current);
      setUser(current?.user ?? null);

      if (current?.user) {
        setProfile(await loadProfile(current.user.id));
      }

      setLoading(false);
    };

    initSession();

    return () => {
      mounted = false;
    };
  }, []);

  // -------------------------------------------------------------------
  // AUTH LISTENER — lebih stabil, tidak memicu refresh berulang
  // -------------------------------------------------------------------
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        const profileData = await loadProfile(newSession.user.id);
        setProfile(profileData);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const value: AuthContextType = {
    session,
    user,
    profile,
    loading,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
