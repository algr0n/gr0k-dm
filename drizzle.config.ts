import type { Config } from "drizzle-kit";

export default {
  schema: "./schema.ts",
  out: "./drizzle",
  dialect: "sqlite",           // ← this is the missing line
  driver: "turso",             // ← and this one
  dbCredentials: {
    url: ":memory:",
  },
} satisfies Config;
