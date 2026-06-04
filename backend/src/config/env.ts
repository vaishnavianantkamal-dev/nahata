import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PORT: parseInt(process.env.PORT || process.env.API_PORT || '4000', 10),
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:5173',
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:4000',

  DATABASE_URL: process.env.DATABASE_URL!,
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_BUCKET: process.env.S3_BUCKET || 'nahata-crm',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
  S3_SECRET_KEY: process.env.S3_SECRET_KEY,

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_in_prod',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_in_prod',
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL || '15m',
  REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL || '7d',

  WHATSAPP_PROVIDER: process.env.WHATSAPP_PROVIDER || 'mock',
  TELEPHONY_PROVIDER: process.env.TELEPHONY_PROVIDER || 'mock',
  STT_PROVIDER: process.env.STT_PROVIDER || 'mock',
  LLM_PROVIDER: process.env.LLM_PROVIDER || 'mock',

  META_WABA_PHONE_NUMBER_ID: process.env.META_WABA_PHONE_NUMBER_ID,
  META_WABA_TOKEN: process.env.META_WABA_TOKEN,
  META_WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN || 'nahata_webhook_verify_2024',
  META_APP_SECRET: process.env.META_APP_SECRET,

  EXOTEL_SID: process.env.EXOTEL_SID,
  EXOTEL_API_KEY: process.env.EXOTEL_API_KEY,
  EXOTEL_API_TOKEN: process.env.EXOTEL_API_TOKEN,
  EXOTEL_CALLER_ID: process.env.EXOTEL_CALLER_ID,
  EXOTEL_WEBHOOK_SECRET: process.env.EXOTEL_WEBHOOK_SECRET,

  DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,

  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  LLM_PROMPT_VERSION: process.env.LLM_PROMPT_VERSION || 'v1',

  WEDMEGOOD_WEBHOOK_SECRET: process.env.WEDMEGOOD_WEBHOOK_SECRET || 'wedmegood_secret_2024',
  JUSTDIAL_WEBHOOK_SECRET: process.env.JUSTDIAL_WEBHOOK_SECRET || 'justdial_secret_2024',
  GOOGLE_MAPS_WEBHOOK_SECRET: process.env.GOOGLE_MAPS_WEBHOOK_SECRET || 'googlemaps_secret_2024',
  WEBSITE_WEBHOOK_SECRET: process.env.WEBSITE_WEBHOOK_SECRET || 'website_secret_2024',

  SCORE_HOT_THRESHOLD: parseInt(process.env.SCORE_HOT_THRESHOLD || '80', 10),
  SCORE_WARM_THRESHOLD: parseInt(process.env.SCORE_WARM_THRESHOLD || '50', 10),
};

