import type { Config } from "drizzle-kit";

export default {
  schema: "./shared/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || "file:test.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
