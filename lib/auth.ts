/**
 * AWS Cognito Authentication Wrapper
 *
 * Login uses client-side SRP (amazon-cognito-identity-js) — no plain-text password over network.
 * After login the refresh token is stored in an httpOnly cookie via /api/auth/store.
 * idToken + accessToken live only in-memory (lib/token.ts).
 */

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  ICognitoStorage,
} from 'amazon-cognito-identity-js';
import { setTokens, getAccessToken } from './token';
import { AuthUser } from './types';

// ─── In-memory storage for Cognito SDK ────────────────────────────────────────
// Prevents Cognito from writing tokens to localStorage.
class MemoryStorage implements ICognitoStorage {
  private store = new Map<string, string>();
  setItem(key: string, value: string) { this.store.set(key, value); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

const memoryStorage = new MemoryStorage();

const poolData = {
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
  Storage: memoryStorage,
};

const userPool = new CognitoUserPool(poolData);

export type SignInResult =
  | { user: AuthUser }
  | { mfaPending: true; submitCode: (code: string) => Promise<{ user: AuthUser }> };

// ─── Shared: extract user + store tokens after a successful session ────────────
async function finaliseSession(session: CognitoUserSession): Promise<{ user: AuthUser }> {
  const idToken = session.getIdToken().getJwtToken();
  const accessToken = session.getAccessToken().getJwtToken();
  const refreshToken = session.getRefreshToken().getToken();

  setTokens(idToken, accessToken);

  await fetch('/api/auth/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const payload = session.getIdToken().payload;
  const role = (payload['custom:role'] as string) || 'client';
  const user: AuthUser = {
    email: payload.email as string,
    role: (role === 'owner' ? 'owner' : 'client') as 'owner' | 'client',
    clientId: payload['custom:client_id'] as string | undefined,
    groups: (payload['cognito:groups'] as string[]) || [],
  };
  return { user };
}

/**
 * Sign in user with email and password (SRP — no plain-text password to Lambda).
 * Returns { user } on success or { mfaPending, submitCode } when TOTP is required.
 */
export const signIn = async (email: string, password: string): Promise<SignInResult> => {
  const authenticationDetails = new AuthenticationDetails({
    Username: email,
    Password: password,
  });

  const cognitoUser = new CognitoUser({
    Username: email,
    Pool: userPool,
    Storage: memoryStorage,
  });

  return new Promise<SignInResult>((resolve, reject) => {
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: async (session) => {
        try { resolve(await finaliseSession(session)); }
        catch (e) { reject(e); }
      },
      onFailure: reject,
      totpRequired: () => {
        resolve({
          mfaPending: true,
          submitCode: (code: string) =>
            new Promise<{ user: AuthUser }>((res, rej) => {
              cognitoUser.sendMFACode(code, {
                onSuccess: async (session) => {
                  try { res(await finaliseSession(session)); }
                  catch (e) { rej(e); }
                },
                onFailure: rej,
              }, 'SOFTWARE_TOKEN_MFA');
            }),
        });
      },
    });
  });
};

/**
 * Sign out — clears httpOnly cookie and in-memory tokens.
 */
export const signOut = async () => {
  setTokens(null, null);
  await fetch('/api/auth/logout', { method: 'POST' });
};

/**
 * Change password — delegates to /api/auth/change-password (server-side).
 */
export const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
  const accessToken = getAccessToken();
  if (!accessToken) throw new Error('Nie jesteś zalogowany.');

  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPassword, newPassword, accessToken }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Zmiana hasła nie powiodła się.');
  }
};
