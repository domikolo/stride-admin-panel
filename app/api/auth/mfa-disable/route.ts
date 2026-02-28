export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  CognitoIdentityProviderClient,
  SetUserMFAPreferenceCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'eu-central-1',
});

export async function POST(req: NextRequest) {
  const { accessToken } = await req.json();
  if (!accessToken) return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 });

  try {
    await cognito.send(new SetUserMFAPreferenceCommand({
      AccessToken: accessToken,
      SoftwareTokenMfaSettings: { Enabled: false, PreferredMfa: false },
    }));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/auth/mfa-disable]', err);
    return NextResponse.json({ error: 'Failed to disable MFA' }, { status: 500 });
  }
}
