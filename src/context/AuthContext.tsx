import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, AuthUser, SESSION_EXPIRED_EVENT, tokenStore } from '../services/apiClient';

type AuthStatus = 'loading' | 'signed_out' | 'signed_in';

interface AuthContextType {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  registerCoach: (payload: { email: string; password: string; fullName: string; inviteCode: string }) => Promise<AuthUser>;
  requestCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  devLogin: (role: 'coach' | 'client') => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => (tokenStore.get() ? 'loading' : 'signed_out'));

  const signIn = useCallback((u: AuthUser) => {
    setUser(u);
    setStatus('signed_in');
    return u;
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
    setStatus('signed_out');
  }, []);

  // Restore the session from a stored token.
  useEffect(() => {
    if (!tokenStore.get()) return;
    let cancelled = false;
    authApi.me()
      .then(u => { if (!cancelled) signIn(u); })
      .catch(() => { if (!cancelled) logout(); });
    return () => { cancelled = true; };
  }, [signIn, logout]);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, logout);
  }, [logout]);

  const value: AuthContextType = {
    status,
    user,
    login: async (email, password) => signIn(await authApi.login(email, password)),
    registerCoach: async payload => signIn(await authApi.registerCoach(payload)),
    requestCode: async email => { await authApi.requestCode(email); },
    verifyCode: async (email, code) => signIn(await authApi.verifyCode(email, code)),
    logout,
    refreshUser: async () => { signIn(await authApi.me()); },
    devLogin: async role => signIn(await authApi.devLogin(role)),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
