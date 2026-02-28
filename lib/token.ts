/**
 * In-memory token storage — tokens live only in JS module scope.
 * Avoids localStorage (XSS-readable). Refresh token is stored in httpOnly cookie by /api/auth/store.
 */

let idToken: string | null = null;
let accessToken: string | null = null;

export const setTokens = (id: string | null, acc: string | null) => {
  idToken = id;
  accessToken = acc;
};

export const getIdToken = () => idToken;
export const getAccessToken = () => accessToken;
