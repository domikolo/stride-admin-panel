export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  CognitoIdentityProviderClient,
  AssociateSoftwareTokenCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'eu-central-1',
});

export async function POST(req: NextRequest) {
  const { accessToken } = await req.json();
  if (!accessToken) return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 });

  try {
    const result = await cognito.send(new AssociateSoftwareTokenCommand({ AccessToken: accessToken }));
    return NextResponse.json({ secretCode: result.SecretCode });
  } catch (err) {
    console.error('[/api/auth/mfa-setup]', err);
    return NextResponse.json({ error: 'Failed to initiate MFA setup' }, { status: 500 });
  }
}
