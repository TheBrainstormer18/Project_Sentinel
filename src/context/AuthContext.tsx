import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { supabase, isClientSupabaseConfigured } from '../services/supabaseClient';
import {
  getStoredToken,
  getStoredUser,
  saveAuthSession,
  clearAuthSession,
} from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isOfficer: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginDemo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [loading, setLoading] = useState<boolean>(true);

  // Helper to fetch user's database role from profiles table
  const fetchProfileRole = async (userId: string, email: string, defaultName: string): Promise<User> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, name')
        .eq('id', userId)
        .maybeSingle();

      const role: UserRole = (data?.role as UserRole) || 'officer';
      const name = data?.name || defaultName || email.split('@')[0];

      return {
        id: userId,
        email,
        name,
        role,
        created_at: new Date().toISOString(),
      };
    } catch {
      return {
        id: userId,
        email,
        name: defaultName,
        role: 'officer',
        created_at: new Date().toISOString(),
      };
    }
  };

  useEffect(() => {
    // 1. Get initial Supabase Auth session
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const accessToken = session.access_token;
          const userObj = await fetchProfileRole(
            session.user.id,
            session.user.email || '',
            session.user.user_metadata?.name || 'User'
          );
          setUser(userObj);
          setToken(accessToken);
          saveAuthSession(accessToken, userObj);
        } else {
          // No active session -> user stays logged out. NO auto-login.
          clearAuthSession();
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.warn('[AuthContext] Session init error:', err);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    // 2. Listen for Supabase Auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && session.user) {
        const accessToken = session.access_token;
        const userObj = await fetchProfileRole(
          session.user.id,
          session.user.email || '',
          session.user.user_metadata?.name || 'User'
        );
        setUser(userObj);
        setToken(accessToken);
        saveAuthSession(accessToken, userObj);
      } else {
        clearAuthSession();
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    if (!isClientSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured yet. Please add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env or Netlify settings.'
      );
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.session && data.user) {
        const accessToken = data.session.access_token;
        const userObj = await fetchProfileRole(
          data.user.id,
          data.user.email || email,
          data.user.user_metadata?.name || 'User'
        );
        setUser(userObj);
        setToken(accessToken);
        saveAuthSession(accessToken, userObj);
      }
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    if (!isClientSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured yet. Please add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env or Netlify settings.'
      );
    }
    setLoading(true);
    try {
      // New users strictly default to officer. User metadata passes the display name.
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.user && !data.session) {
        throw new Error(
          'Account registered! Please check your email inbox to confirm your account, or disable "Confirm email" in your Supabase Auth settings to enable immediate login.'
        );
      }

      if (data.session && data.user) {
        const accessToken = data.session.access_token;
        const userObj = await fetchProfileRole(data.user.id, data.user.email || email, name);
        setUser(userObj);
        setToken(accessToken);
        saveAuthSession(accessToken, userObj);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (!isClientSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured yet. Please add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env or Netlify settings.'
      );
    }
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    if (error) {
      throw new Error(error.message);
    }
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      throw new Error(error.message);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthContext] Sign out warning:', err);
    } finally {
      clearAuthSession();
      setUser(null);
      setToken(null);
    }
  };

  const loginDemo = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Demo login failed');
      }

      if (data.access_token && data.refresh_token && data.access_token !== 'demo-local-fallback-token') {
        // Sync real Supabase Auth session on the client
        try {
          await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });
        } catch (sbErr) {
          console.warn('[AuthContext] Supabase setSession notice:', sbErr);
        }
      }

      setUser(data.user);
      setToken(data.access_token);
      saveAuthSession(data.access_token, data.user);
    } finally {
      setLoading(false);
    }
  };

  const isAuthenticated = !!token && !!user;
  const isAdmin = user?.role === 'admin';
  const isOfficer = user?.role === 'officer';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isAdmin,
        isOfficer,
        loading,
        login,
        register,
        resetPassword,
        updatePassword,
        logout,
        loginDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
