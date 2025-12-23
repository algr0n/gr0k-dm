import type { Config } from "drizzle-kit";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, ".env") });

export default {
  schema: ["./shared/schema.ts", "./shared/adventure-schema.ts"],
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || "file:test.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
