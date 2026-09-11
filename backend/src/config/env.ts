import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  // The app's only database access is through @supabase/supabase-js over
  // HTTPS — there is no direct Postgres connection at runtime. (DIRECT_URL,
  // used only by `npm run db:migrate`'s standalone script, is deliberately
  // NOT part of this schema — the running app never reads it.)
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("30d"),

  // Shared HTTP email service (NOT Resend, no SMTP) — leave the API key
  // unset in dev/test to fall back to a console provider instead.
  EMAIL_SERVICE_URL: z.string().url().default("https://college-management-zfbc.vercel.app/api/send"),
  EMAIL_SERVICE_API_KEY: z.string().optional().default(""),

  APP_URL: z.string().default("http://localhost:4000"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  CRON_INTERVAL_MINUTES: z.coerce.number().int().positive().default(5),
  MAX_EMAIL_RETRIES: z.coerce.number().int().positive().default(4),

  // Set to "false" when running the reminder engine as a separate
  // `npm run worker:start` process/service instead of in-process with the API.
  RUN_JOBS_IN_API_PROCESS: z.enum(["true", "false"]).default("true"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
