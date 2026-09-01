import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import {
  getStoredToken,
  getStoredUser,
  loginUser,
  registerUser,
  fetchCurrentUser,
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
  register: (name: string, email: string, password: string, role?: UserRole) => Promise<void>;
  logout: () => void;
  switchRoleDemo: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getStoredToken();
      if (storedToken) {
        try {
          const freshUser = await fetchCurrentUser();
          setUser(freshUser);
          setToken(storedToken);
        } catch {
          // Token expired or invalid
          setUser(null);
          setToken(null);
          clearAuthSession();
        }
      } else {
        // Auto-initialize demo Admin account if first session to make preview immediately accessible
        try {
          const res = await loginUser({
            email: 'admin@projectsentinel.ai',
            password: 'Admin123',
          });
          setUser(res.user);
          setToken(res.access_token);
        } catch {
          // If login fails, remain logged out
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await loginUser({ email, password });
      setUser(res.user);
      setToken(res.access_token);
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string, role: UserRole = 'officer') => {
    setLoading(true);
    try {
      const res = await registerUser({ name, email, password, role });
      setUser(res.user);
      setToken(res.access_token);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearAuthSession();
    setUser(null);
    setToken(null);
  };

  const switchRoleDemo = async (role: UserRole) => {
    if (role === 'admin') {
      await login('admin@projectsentinel.ai', 'Admin123');
    } else {
      await login('officer@projectsentinel.ai', 'Officer123');
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
        logout,
        switchRoleDemo,
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
