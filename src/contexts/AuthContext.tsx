import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthUser as User, AuthSession as Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileFetched: boolean;
  /** Erro ao buscar perfil (RLS, rede, etc.) */
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  /** Tenta carregar o perfil de novo (útil se acabou de inserir no Supabase) */
  refetchProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileFetched, setProfileFetched] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  async function fetchProfile(uid: string) {
    setProfileError(null);
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (error) {
      setProfileError(error.message);
      setProfile(null);
    } else {
      setProfile(data ?? null);
    }
    setProfileFetched(true);
  }

  async function refetchProfile() {
    const uid = user?.id;
    if (uid) {
      setProfileFetched(false);
      setProfileError(null);
      await fetchProfile(uid);
    }
  }

  useEffect(() => {
    setProfileFetched(false);
    setProfileError(null);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setProfileFetched(true);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        setProfileFetched(false);
        setProfileError(null);
        setProfile(null);
        await fetchProfile(session.user.id);
      } else {
        if (document.hidden) return;
        await new Promise((r) => setTimeout(r, 400));
        const { data: { session: current } } = await supabase.auth.getSession();
        if (current) {
          setSession(current);
          setUser(current.user);
          setProfileFetched(false);
          await fetchProfile(current.user.id);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          setProfileFetched(true);
        }
      }
    });

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setSession(session);
          setUser(session.user);
          fetchProfile(session.user.id);
        }
      });
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, profileFetched, profileError, signIn, signOut, refetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
