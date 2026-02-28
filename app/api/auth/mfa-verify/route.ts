export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  CognitoIdentityProviderClient,
  VerifySoftwareTokenCommand,
  SetUserMFAPreferenceCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'eu-central-1',
});

export async function POST(req: NextRequest) {
  const { accessToken, code } = await req.json();
  if (!accessToken || !code) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  try {
    const verify = await cognito.send(new VerifySoftwareTokenCommand({
      AccessToken: accessToken,
      UserCode: code,
      FriendlyDeviceName: 'Authenticator',
    }));

    if (verify.Status !== 'SUCCESS') {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    await cognito.send(new SetUserMFAPreferenceCommand({
      AccessToken: accessToken,
      SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
    }));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/auth/mfa-verify]', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }
}
