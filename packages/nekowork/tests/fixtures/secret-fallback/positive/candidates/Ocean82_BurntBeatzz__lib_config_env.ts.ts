<<<<<<< HEAD
import "server-only"

/**
 * Server-only environment configuration.
 * This file is protected by "server-only" import to prevent client bundling.
 */

=======
// Parse whitelisted IPs
>>>>>>> ac05bde066e7c465bf6cf291993fec9ae72ff6fd
const parseWhitelistedIps = (ips?: string): string[] => {
  if (!ips) return []
  return ips.split(",").map((ip) => ip.trim())
}

<<<<<<< HEAD
export const env = {
  // Core Application
  NODE_ENV: process.env.NODE_ENV || "development",
  APP_VERSION: process.env.APP_VERSION || "1.0.0",
  PORT: process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000,

  // Database - Using correct Neon environment variables
  DATABASE_URL: process.env.DATABASE_URL || process.env.POSTGRES_URL || "",
  DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || "",
  POSTGRES_HOST: process.env.POSTGRES_HOST || process.env.PGHOST || "",
  POSTGRES_USER: process.env.POSTGRES_USER || process.env.PGUSER || "",
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || "",
  POSTGRES_DATABASE: process.env.POSTGRES_DATABASE || process.env.PGDATABASE || "",

  // Google Cloud Storage - Using correct variable names
  GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID || "",
  GOOGLE_CLOUD_KEY_FILE: process.env.GOOGLE_CLOUD_KEY_FILE || "",
  GOOGLE_CLOUD_BUCKET_NAME: process.env.GOOGLE_CLOUD_BUCKET_NAME || process.env.burnt_beats_bucket || "",

  // GitHub Integration - Using correct token format
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || "",

  // Stack Auth - Using correct Stack Auth variables (server-side only)
  NEXT_PUBLIC_STACK_PROJECT_ID: process.env.NEXT_PUBLIC_STACK_PROJECT_ID || "",
  STACK_SECRET_SERVER_KEY: process.env.STACK_SECRET_SERVER_KEY || "",

  // Stripe - Using correct Stripe variable names
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  STRIPE_WHITELISTED_IPS: parseWhitelistedIps(process.env.STRIPE_WHITELISTED_IPS),

  // Python Backend
  PYTHON_PATH: process.env.PYTHON_PATH || "python3",

  // Session & Security
=======
// Configuration object
export const env = {
  // Core
  NODE_ENV: process.env.NODE_ENV || "development",
  APP_VERSION: process.env.APP_VERSION || "1.0.0",
  PORT: process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 5000,

  // Database
  DATABASE_URL: process.env.DATABASE_URL || "",

  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  STRIPE_WHITELISTED_IPS: parseWhitelistedIps(process.env.STRIPE_WHITELISTED_IPS),

  // Session
>>>>>>> ac05bde066e7c465bf6cf291993fec9ae72ff6fd
  SESSION_SECRET: process.env.SESSION_SECRET || "burnt-beats-secret-key",

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // Support
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || "support@burnt-beats.com",

<<<<<<< HEAD
  // Feature Flags
  RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED !== "false",
  IP_FILTER_ENABLED: process.env.IP_FILTER_ENABLED !== "false",

  // Validation helpers
  isProduction: () => process.env.NODE_ENV === "production",
  isDevelopment: () => process.env.NODE_ENV === "development",

  // Required variables check
  validateRequired: () => {
    const required = [
      "DATABASE_URL",
      "GOOGLE_CLOUD_PROJECT_ID",
      "GOOGLE_CLOUD_BUCKET_NAME",
      "NEXT_PUBLIC_STACK_PROJECT_ID",
      "STACK_SECRET_SERVER_KEY",
    ]

    const missing = required.filter((key) => !process.env[key])
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
    }
  },
}

=======
  // Security
  RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED !== "false",
  IP_FILTER_ENABLED: process.env.IP_FILTER_ENABLED !== "false",
}

// Type-safe environment export
>>>>>>> ac05bde066e7c465bf6cf291993fec9ae72ff6fd
export type EnvConfig = typeof env
export default env
