export const ENV = {
  // Session cookie signing secret. Set JWT_SECRET in production.
  cookieSecret: process.env.JWT_SECRET ?? "",
  // Hidden admin sign-in (MODEL-LOCKED #8) — never exposed to the browser.
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  // Local SQLite database file and upload storage directory.
  databasePath: process.env.KHALIS_DB_PATH ?? "",
  dataDir: process.env.KHALIS_DATA_DIR ?? "",
  // Gemini API keys for the AI support chat (Stage C). Any of GEMINI_API_KEY
  // or GEMINI_KEY_1..3 may be set; calls rotate across them on quota errors.
  geminiApiKeys: [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_KEY_1,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3,
  ].filter((value): value is string => Boolean(value && value.trim())),
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  isProduction: process.env.NODE_ENV === "production",
};
