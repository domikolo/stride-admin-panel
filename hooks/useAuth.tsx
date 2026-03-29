/**
 * Authentication Context and Hook
 */

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn as cognitoSignIn, signOut as cognitoSignOut } from '@/lib/auth';
import { setTokens, getAccessToken } from '@/lib/token';
import { AuthUser } from '@/lib/types';

async function checkMfaRequired(user: AuthUser): Promise<boolean> {
  if (user.role !== 'owner') return false;
  try {
    const token = getAccessToken();
    if (!token) return false;
    const res = await fetch('/api/auth/mfa-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: token }),
    });
    const data = await res.json();
    return !data.enabled;
  } catch {
    return false;
  }
}

export interface NewPasswordPending {
  newPasswordPending: true;
  submitNewPassword: (newPassword: string) => Promise<void>;
}

export interface MfaPending {
  mfaPending: true;
  submitCode: (code: string) => Promise<void>;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<MfaPending | NewPasswordPending | void>;
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

  const getReturnTo = () => {
    if (typeof window === 'undefined') return '/dashboard';
    const saved = sessionStorage.getItem('returnTo');
    sessionStorage.removeItem('returnTo');
    return saved || '/dashboard';
  };

  const signIn = async (email: string, password: string): Promise<MfaPending | NewPasswordPending | void> => {
    const result = await cognitoSignIn(email, password);
    if ('mfaPending' in result) {
      return {
        mfaPending: true,
        submitCode: async (code: string) => {
          const { user } = await result.submitCode(code);
          setUser(user);
          router.push(getReturnTo());
        },
      };
    }
    if ('newPasswordPending' in result) {
      return {
        newPasswordPending: true,
        submitNewPassword: async (newPassword: string) => {
          const { user } = await result.submitNewPassword(newPassword);
          setUser(user);
          router.push(getReturnTo());
        },
      };
    }
    const u = result.user;
    setUser(u);
    const mfaRequired = await checkMfaRequired(u);
    router.push(mfaRequired ? '/mfa-setup' : getReturnTo());
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
