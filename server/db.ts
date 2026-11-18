import Database from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "../drizzle/schema";
import { gwalaProfiles, subscriptions, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

// SQLite local file database (better-sqlite3 + Drizzle). Tables are created
// at boot with CREATE TABLE IF NOT EXISTS so the app runs anywhere with no
// external database server.

export type Db = BetterSQLite3Database<typeof schema>;

let _db: Db | null = null;

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  phone TEXT,
  accountType TEXT NOT NULL DEFAULT 'customer',
  preferredLanguage TEXT NOT NULL DEFAULT 'en',
  referralCode TEXT,
  loginMethod TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  lastSignedIn INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique ON users (referralCode);
CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  province TEXT NOT NULL DEFAULT 'Punjab',
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS cities_name_province_unique ON cities (name, province);
CREATE TABLE IF NOT EXISTS service_areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cityId INTEGER NOT NULL,
  name TEXT NOT NULL,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS service_areas_city_name_unique ON service_areas (cityId, name);
CREATE TABLE IF NOT EXISTS area_waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city TEXT NOT NULL,
  area TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  consentToContact INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS gwala_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  displayName TEXT NOT NULL,
  phone TEXT NOT NULL,
  cnicMasked TEXT NOT NULL,
  cnicHash TEXT,
  city TEXT NOT NULL,
  primaryArea TEXT NOT NULL,
  routeDescription TEXT,
  availability TEXT NOT NULL,
  pricePerLitre TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  qualityStatus TEXT NOT NULL DEFAULT 'clear',
  isFeatured INTEGER NOT NULL DEFAULT 0,
  ratingAverage TEXT NOT NULL DEFAULT '0.00',
  ratingCount INTEGER NOT NULL DEFAULT 0,
  lowRatingFlagCount INTEGER NOT NULL DEFAULT 0,
  reviewNotes TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS gwala_profiles_user_id_unique ON gwala_profiles (userId);
CREATE UNIQUE INDEX IF NOT EXISTS gwala_profiles_cnic_hash_unique ON gwala_profiles (cnicHash);
CREATE TABLE IF NOT EXISTS gwala_service_areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gwalaId INTEGER NOT NULL,
  serviceAreaId INTEGER,
  city TEXT NOT NULL,
  area TEXT NOT NULL,
  deliverySlots TEXT NOT NULL,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS gwala_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gwalaId INTEGER NOT NULL,
  documentType TEXT NOT NULL,
  storageKey TEXT NOT NULL,
  fileName TEXT NOT NULL,
  contentType TEXT NOT NULL,
  fileSizeBytes INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId INTEGER NOT NULL,
  gwalaId INTEGER NOT NULL,
  city TEXT NOT NULL,
  area TEXT NOT NULL,
  addressLine TEXT,
  landmark TEXT,
  mapLatitude TEXT,
  mapLongitude TEXT,
  plan TEXT NOT NULL,
  litresPerDay INTEGER NOT NULL,
  deliveryDays TEXT NOT NULL DEFAULT 'mon,tue,wed,thu,fri,sat,sun',
  startDate TEXT NOT NULL,
  pricePerLitre TEXT NOT NULL,
  estimatedAmount TEXT NOT NULL,
  paymentMethod TEXT NOT NULL,
  paymentStatus TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'pending',
  cancelledAt INTEGER,
  cancellationReason TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS delivery_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscriptionId INTEGER NOT NULL,
  scheduledDate TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  completedAt INTEGER,
  outForDeliveryAt INTEGER,
  photoStorageKey TEXT,
  notes TEXT,
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS payment_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscriptionId INTEGER NOT NULL,
  amount TEXT NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reference TEXT,
  receiptCode TEXT,
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS gwala_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId INTEGER NOT NULL,
  gwalaId INTEGER NOT NULL,
  score INTEGER NOT NULL,
  comment TEXT,
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId INTEGER NOT NULL,
  gwalaId INTEGER NOT NULL,
  deliveryId INTEGER,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'standard',
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  decision TEXT,
  deductedAmount TEXT,
  decidedAt INTEGER,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId INTEGER,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS referral_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrerUserId INTEGER NOT NULL,
  referredUserId INTEGER,
  referralCode TEXT NOT NULL,
  creditAmount TEXT NOT NULL DEFAULT '0.00',
  status TEXT NOT NULL DEFAULT 'pending',
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS gwala_quality_audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gwalaId INTEGER NOT NULL,
  auditDate TEXT NOT NULL,
  auditorName TEXT,
  lactometerReading TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS broadcast_announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audience TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  deliveryChannel TEXT NOT NULL DEFAULT 'in_app',
  createdByUserId INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS marketplace_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipientUserId INTEGER,
  recipientType TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  isRead INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS khata_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId INTEGER NOT NULL,
  gwalaId INTEGER NOT NULL,
  subscriptionId INTEGER,
  deliveryId INTEGER,
  productOrderId INTEGER,
  entryType TEXT NOT NULL,
  entryDate TEXT NOT NULL,
  description TEXT NOT NULL,
  litres INTEGER,
  rate TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS gwala_fee_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gwalaId INTEGER NOT NULL,
  kind TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  amount TEXT NOT NULL DEFAULT '0.00',
  startsAt INTEGER NOT NULL,
  endsAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS gwala_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gwalaId INTEGER NOT NULL,
  name TEXT NOT NULL,
  price TEXT NOT NULL,
  unit TEXT NOT NULL,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS product_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId INTEGER NOT NULL,
  gwalaId INTEGER NOT NULL,
  productId INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  amount TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_chat_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identity TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updatedAt INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_chat_usage_identity_day_unique ON ai_chat_usage (identity, day);
`;

// Starter coverage so the marketplace is usable in testing before the admin
// adds cities/areas from the coverage pages.
const SEED_CITIES: Array<{ name: string; areas: string[] }> = [
  { name: "Lahore", areas: ["DHA", "Gulberg", "Johar Town", "Model Town", "Bahria Town"] },
  { name: "Faisalabad", areas: ["Madina Town", "Peoples Colony", "Eden Gardens"] },
  { name: "Multan", areas: ["Cantt", "Gulgasht Colony", "Bosan Road"] },
  { name: "Rawalpindi", areas: ["Bahria Town", "Satellite Town", "Chaklala"] },
  { name: "Gujranwala", areas: ["Satellite Town", "Model City", "Cantt"] },
  { name: "Pakpattan", areas: ["Arifwala Road", "Sahiwal Road", "City Center"] },
];

function initDb(): Db {
  const dbPath = ENV.databasePath || path.resolve(process.cwd(), "data", "khalis-doodh.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(DDL);
  const db = drizzle(sqlite, { schema });

  const cityCount = sqlite.prepare("SELECT COUNT(*) AS c FROM cities").get() as { c: number };
  if (cityCount.c === 0) {
    const insertCity = sqlite.prepare("INSERT INTO cities (name, province, isActive, createdAt) VALUES (?, 'Punjab', 1, ?)");
    const insertArea = sqlite.prepare("INSERT INTO service_areas (cityId, name, isActive, createdAt) VALUES (?, ?, 1, ?)");
    const now = Date.now();
    for (const city of SEED_CITIES) {
      const info = insertCity.run(city.name, now);
      for (const area of city.areas) insertArea.run(Number(info.lastInsertRowid), area, now);
    }
    console.log(`[Database] Seeded ${SEED_CITIES.length} starter cities in ${dbPath}`);
  }
  return db;
}

export async function getDb(): Promise<Db> {
  if (!_db) {
    _db = initDb();
  }
  return _db;
}

export async function getUserById(id: number) {
  const db = await getDb();
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function getGwalaByUserId(userId: number) {
  const db = await getDb();
  const result = await db.select().from(gwalaProfiles).where(eq(gwalaProfiles.userId, userId)).limit(1);
  return result[0];
}

export async function getSubscriptionForCustomer(subscriptionId: number, customerId: number) {
  const db = await getDb();
  const result = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.customerId, customerId)))
    .limit(1);
  return result[0];
}
