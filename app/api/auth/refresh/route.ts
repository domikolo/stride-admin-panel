export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'eu-central-1',
});

function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(base64, 'base64').toString('utf-8');
  return JSON.parse(json);
}

export async function GET(req: NextRequest) {
  const refreshToken = req.cookies.get('refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  try {
    const result = await cognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      })
    );

    const idToken = result.AuthenticationResult?.IdToken;
    const accessToken = result.AuthenticationResult?.AccessToken;

    if (!idToken || !accessToken) {
      return NextResponse.json({ error: 'No tokens returned' }, { status: 401 });
    }

    const payload = decodeJwtPayload(idToken);
    const role = (payload['custom:role'] as string) || 'client';
    const user = {
      email: payload.email as string,
      role: role === 'owner' ? 'owner' : 'client',
      clientId: payload['custom:client_id'] as string | undefined,
      groups: (payload['cognito:groups'] as string[]) || [],
    };

    return NextResponse.json({ idToken, accessToken, user });
  } catch (err) {
    console.error('[/api/auth/refresh] Error:', err);
    return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 });
  }
}
