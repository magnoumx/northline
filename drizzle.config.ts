import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: [
    "./db/schema.ts",
    "./db/schema-v2.ts",
    "./db/schema-v3-content.ts",
    "./db/schema-v3-ai.ts",
    "./db/schema-v3-auth.ts",
    "./db/schema-v3-operations.ts",
    "./db/schema-v4-audio.ts",
    "./db/schema-v4-intelligence.ts",
    "./db/schema-v7-settings.ts",
  ],
  dialect: "sqlite",
});
