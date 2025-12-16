/**
 * Application constants
 */

export const APP_NAME = 'Stride Admin';
export const APP_DESCRIPTION = 'Admin panel for Stride Services SaaS platform';

// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// AWS Cognito Configuration
export const COGNITO_REGION = process.env.NEXT_PUBLIC_COGNITO_REGION || 'eu-central-1';
export const COGNITO_USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
export const COGNITO_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

// Default pagination
export const DEFAULT_PAGE_SIZE = 50;

// Stats periods
export const STATS_PERIODS = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const;

export type StatsPeriod = typeof STATS_PERIODS[keyof typeof STATS_PERIODS];
