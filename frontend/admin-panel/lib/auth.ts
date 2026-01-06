/**
 * AWS Cognito Authentication Wrapper
 */

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { AuthUser } from './types';

const poolData = {
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
};

const userPool = new CognitoUserPool(poolData);

/**
 * Sign in user with email and password
 */
export const signIn = async (email: string, password: string): Promise<CognitoUserSession> => {
  const authenticationDetails = new AuthenticationDetails({
    Username: email,
    Password: password,
  });

  const cognitoUser = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (session) => {
        resolve(session);
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
};

/**
 * Sign out current user
 */
export const signOut = () => {
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) {
    cognitoUser.signOut();
  }
};

/**
 * Get current session
 */
export const getCurrentSession = (): Promise<CognitoUserSession | null> => {
  console.log('[Auth] Getting current session...');
  console.log('[Auth] UserPool config:', {
    UserPoolId: poolData.UserPoolId,
    ClientId: poolData.ClientId,
  });

  const cognitoUser = userPool.getCurrentUser();
  console.log('[Auth] getCurrentUser() returned:', cognitoUser?.getUsername() || 'null');

  if (!cognitoUser) {
    console.log('[Auth] No current user found in pool');
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) {
        console.error('[Auth] getSession() error:', err);
        resolve(null);
      } else if (!session) {
        console.log('[Auth] getSession() returned null session');
        resolve(null);
      } else {
        console.log('[Auth] Session found, isValid:', session.isValid());
        resolve(session);
      }
    });
  });
};

/**
 * Get ID token (JWT) from current session
 */
export const getIdToken = async (): Promise<string | null> => {
  const session = await getCurrentSession();
  const token = session?.getIdToken().getJwtToken() || null;
  console.log('[Auth] getIdToken() returning:', token ? `${token.substring(0, 20)}...` : 'null');
  return token;
};

/**
 * Get user info from session
 */
export const getUserFromSession = async (): Promise<AuthUser | null> => {
  const session = await getCurrentSession();
  if (!session) return null;

  const idToken = session.getIdToken();
  const payload = idToken.payload;

  return {
    email: payload.email,
    role: payload['custom:role'] || 'client',
    clientId: payload['custom:client_id'],
    groups: payload['cognito:groups'] || [],
  };
};
