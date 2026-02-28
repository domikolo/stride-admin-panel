/**
 * Authentication Context and Hook
 */

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn as cognitoSignIn, signOut as cognitoSignOut } from '@/lib/auth';
import { setTokens } from '@/lib/token';
import { AuthUser } from '@/lib/types';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // On mount: attempt to restore session via httpOnly refresh token cookie
    fetch('/api/auth/refresh')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setTokens(data.idToken, data.accessToken);
          setUser(data.user);
        }
      })
      .catch(() => { /* no session */ })
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    const { user } = await cognitoSignIn(email, password);
    setUser(user);
    router.push('/dashboard');
  };

  const signOut = async () => {
    await cognitoSignOut();
    setTokens(null, null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
