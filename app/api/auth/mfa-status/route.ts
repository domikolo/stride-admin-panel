export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'eu-central-1',
});

export async function POST(req: NextRequest) {
  const { accessToken } = await req.json();
  if (!accessToken) return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 });

  try {
    const result = await cognito.send(new GetUserCommand({ AccessToken: accessToken }));
    const enabled = result.UserMFASettingList?.includes('SOFTWARE_TOKEN_MFA') ?? false;
    return NextResponse.json({ enabled });
  } catch (err) {
    console.error('[/api/auth/mfa-status]', err);
    return NextResponse.json({ error: 'Failed to get MFA status' }, { status: 500 });
  }
}
