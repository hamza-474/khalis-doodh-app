import { defineConfig } from "drizzle-kit";

// SQLite local file DB (see server/db.ts — tables are created at boot).
export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.KHALIS_DB_PATH || "./data/khalis-doodh.db",
  },
});
