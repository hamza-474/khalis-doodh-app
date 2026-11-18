import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Khalis Doodh — SQLite schema (local file DB via better-sqlite3).
// Money values are stored as decimal strings (e.g. "250.00") to match the
// original MySQL decimal-as-string behaviour used across the codebase.

const createdAt = () =>
  integer("createdAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull();
const updatedAt = () =>
  integer("updatedAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull();

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  email: text("email", { length: 320 }).notNull().unique(),
  passwordHash: text("passwordHash").notNull(),
  phone: text("phone", { length: 32 }),
  // An account is exactly one kind — separate-accounts rule (MODEL-LOCKED #7).
  accountType: text("accountType", { enum: ["customer", "gwala", "admin"] }).default("customer").notNull(),
  preferredLanguage: text("preferredLanguage", { enum: ["en", "ur"] }).default("en").notNull(),
  referralCode: text("referralCode", { length: 32 }),
  loginMethod: text("loginMethod", { length: 64 }),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
}, table => [uniqueIndex("users_referral_code_unique").on(table.referralCode)]);

export const cities = sqliteTable("cities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name", { length: 80 }).notNull(),
  province: text("province", { length: 80 }).default("Punjab").notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: createdAt(),
}, table => [uniqueIndex("cities_name_province_unique").on(table.name, table.province)]);

export const serviceAreas = sqliteTable("service_areas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cityId: integer("cityId").notNull(),
  name: text("name", { length: 120 }).notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: createdAt(),
}, table => [uniqueIndex("service_areas_city_name_unique").on(table.cityId, table.name)]);

export const areaWaitlist = sqliteTable("area_waitlist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city", { length: 80 }).notNull(),
  area: text("area", { length: 120 }).notNull(),
  name: text("name", { length: 120 }),
  phone: text("phone", { length: 32 }),
  email: text("email", { length: 320 }),
  consentToContact: integer("consentToContact", { mode: "boolean" }).default(true).notNull(),
  createdAt: createdAt(),
});

export const gwalaProfiles = sqliteTable(
  "gwala_profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    displayName: text("displayName", { length: 120 }).notNull(),
    phone: text("phone", { length: 32 }).notNull(),
    cnicMasked: text("cnicMasked", { length: 32 }).notNull(),
    cnicHash: text("cnicHash", { length: 128 }),
    city: text("city", { length: 80 }).notNull(),
    primaryArea: text("primaryArea", { length: 120 }).notNull(),
    routeDescription: text("routeDescription"),
    availability: text("availability", { length: 180 }).notNull(),
    pricePerLitre: text("pricePerLitre").notNull(),
    status: text("status", { enum: ["pending", "verified", "rejected", "suspended"] }).default("pending").notNull(),
    qualityStatus: text("qualityStatus", { enum: ["clear", "flagged"] }).default("clear").notNull(),
    isFeatured: integer("isFeatured", { mode: "boolean" }).default(false).notNull(),
    ratingAverage: text("ratingAverage").default("0.00").notNull(),
    ratingCount: integer("ratingCount").default(0).notNull(),
    lowRatingFlagCount: integer("lowRatingFlagCount").default(0).notNull(),
    reviewNotes: text("reviewNotes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  table => [uniqueIndex("gwala_profiles_user_id_unique").on(table.userId), uniqueIndex("gwala_profiles_cnic_hash_unique").on(table.cnicHash)],
);

export const gwalaServiceAreas = sqliteTable("gwala_service_areas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gwalaId: integer("gwalaId").notNull(),
  serviceAreaId: integer("serviceAreaId"),
  city: text("city", { length: 80 }).notNull(),
  area: text("area", { length: 120 }).notNull(),
  deliverySlots: text("deliverySlots", { length: 180 }).notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: createdAt(),
});

export const gwalaDocuments = sqliteTable("gwala_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gwalaId: integer("gwalaId").notNull(),
  documentType: text("documentType", { enum: ["cnic", "area_proof"] }).notNull(),
  storageKey: text("storageKey", { length: 255 }).notNull(),
  fileName: text("fileName", { length: 180 }).notNull(),
  contentType: text("contentType", { length: 100 }).notNull(),
  fileSizeBytes: integer("fileSizeBytes").notNull(),
  createdAt: createdAt(),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customerId").notNull(),
  gwalaId: integer("gwalaId").notNull(),
  city: text("city", { length: 80 }).notNull(),
  area: text("area", { length: 120 }).notNull(),
  addressLine: text("addressLine", { length: 255 }),
  landmark: text("landmark", { length: 180 }),
  mapLatitude: text("mapLatitude"),
  mapLongitude: text("mapLongitude"),
  plan: text("plan", { enum: ["weekly", "monthly"] }).notNull(),
  litresPerDay: integer("litresPerDay").notNull(),
  deliveryDays: text("deliveryDays", { length: 64 }).default("mon,tue,wed,thu,fri,sat,sun").notNull(),
  startDate: text("startDate", { length: 10 }).notNull(),
  pricePerLitre: text("pricePerLitre").notNull(),
  estimatedAmount: text("estimatedAmount").notNull(),
  paymentMethod: text("paymentMethod", { enum: ["cod", "bank_transfer", "easypaisa", "jazzcash", "card"] }).notNull(),
  paymentStatus: text("paymentStatus", { enum: ["pending", "paid", "overdue"] }).default("pending").notNull(),
  status: text("status", { enum: ["pending", "active", "paused", "declined", "cancelled"] }).default("pending").notNull(),
  cancelledAt: integer("cancelledAt", { mode: "timestamp_ms" }),
  cancellationReason: text("cancellationReason", { length: 500 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const deliveryRecords = sqliteTable("delivery_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subscriptionId: integer("subscriptionId").notNull(),
  scheduledDate: text("scheduledDate", { length: 10 }).notNull(),
  status: text("status", { enum: ["scheduled", "out_for_delivery", "delivered", "missed", "skipped"] }).default("scheduled").notNull(),
  completedAt: integer("completedAt", { mode: "timestamp_ms" }),
  outForDeliveryAt: integer("outForDeliveryAt", { mode: "timestamp_ms" }),
  photoStorageKey: text("photoStorageKey", { length: 255 }),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const paymentRecords = sqliteTable("payment_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subscriptionId: integer("subscriptionId").notNull(),
  amount: text("amount").notNull(),
  method: text("method", { enum: ["cod", "bank_transfer", "easypaisa", "jazzcash", "card"] }).notNull(),
  status: text("status", { enum: ["pending", "paid", "failed"] }).default("pending").notNull(),
  reference: text("reference", { length: 120 }),
  receiptCode: text("receiptCode", { length: 80 }),
  createdAt: createdAt(),
});

// LOCKED MODEL #9: one rating per customer per gwala per rolling 30 days
// (replaces the old per-delivery rating table).
export const gwalaRatings = sqliteTable("gwala_ratings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customerId").notNull(),
  gwalaId: integer("gwalaId").notNull(),
  score: integer("score").notNull(),
  comment: text("comment"),
  createdAt: createdAt(),
});

export const complaints = sqliteTable("complaints", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customerId").notNull(),
  gwalaId: integer("gwalaId").notNull(),
  deliveryId: integer("deliveryId"),
  category: text("category", { enum: ["quality", "late_delivery", "conduct", "other"] }).notNull(),
  severity: text("severity", { enum: ["standard", "serious"] }).default("standard").notNull(),
  details: text("details").notNull(),
  status: text("status", { enum: ["open", "in_review", "resolved", "closed"] }).default("open").notNull(),
  // Admin deduction decision (locked model): "deducted" | "dismissed" | null
  decision: text("decision", { enum: ["deducted", "dismissed"] }),
  deductedAmount: text("deductedAmount"),
  decidedAt: integer("decidedAt", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const supportTickets = sqliteTable("support_tickets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customerId"),
  subject: text("subject", { length: 180 }).notNull(),
  category: text("category", { enum: ["delivery", "payment", "subscription", "account", "other"] }).notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["open", "in_progress", "resolved", "closed"] }).default("open").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const referralCredits = sqliteTable("referral_credits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  referrerUserId: integer("referrerUserId").notNull(),
  referredUserId: integer("referredUserId"),
  referralCode: text("referralCode", { length: 32 }).notNull(),
  creditAmount: text("creditAmount").default("0.00").notNull(),
  status: text("status", { enum: ["pending", "earned", "applied", "expired"] }).default("pending").notNull(),
  createdAt: createdAt(),
});

export const gwalaQualityAudits = sqliteTable("gwala_quality_audits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gwalaId: integer("gwalaId").notNull(),
  auditDate: text("auditDate", { length: 10 }).notNull(),
  auditorName: text("auditorName", { length: 120 }),
  lactometerReading: text("lactometerReading"),
  notes: text("notes"),
  status: text("status", { enum: ["planned", "passed", "needs_follow_up"] }).default("planned").notNull(),
  createdAt: createdAt(),
});

export const broadcastAnnouncements = sqliteTable("broadcast_announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  audience: text("audience", { enum: ["customers", "gwalas", "all"] }).notNull(),
  title: text("title", { length: 180 }).notNull(),
  message: text("message").notNull(),
  deliveryChannel: text("deliveryChannel", { enum: ["in_app", "sms_ready", "whatsapp_ready"] }).default("in_app").notNull(),
  createdByUserId: integer("createdByUserId").notNull(),
  createdAt: createdAt(),
});

export const marketplaceNotifications = sqliteTable("marketplace_notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipientUserId: integer("recipientUserId"),
  recipientType: text("recipientType", { enum: ["customer", "gwala", "owner"] }).notNull(),
  kind: text("kind", { enum: ["subscription_request", "vendor_registration", "serious_complaint", "quality_flag", "waitlist_signup", "support_ticket", "broadcast", "payment_reminder", "subscription_renewal"] }).notNull(),
  title: text("title", { length: 180 }).notNull(),
  body: text("body").notNull(),
  isRead: integer("isRead", { mode: "boolean" }).default(false).notNull(),
  createdAt: createdAt(),
});

// LOCKED MODEL #5: the shared khata ledger. Every delivered delivery and every
// product order creates one entry. No delivery = no entry. An approved
// complaint removes the entry's amount from the khata (status "removed");
// while a complaint is undecided the entry is "disputed".
export const khataEntries = sqliteTable("khata_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customerId").notNull(),
  gwalaId: integer("gwalaId").notNull(),
  subscriptionId: integer("subscriptionId"),
  deliveryId: integer("deliveryId"),
  productOrderId: integer("productOrderId"),
  entryType: text("entryType", { enum: ["delivery", "product"] }).notNull(),
  entryDate: text("entryDate", { length: 10 }).notNull(), // YYYY-MM-DD
  description: text("description", { length: 255 }).notNull(),
  litres: integer("litres"),
  rate: text("rate").notNull(),
  amount: text("amount").notNull(),
  status: text("status", { enum: ["active", "disputed", "removed"] }).default("active").notNull(),
  createdAt: createdAt(),
});

// LOCKED MODEL #2/#3: platform income — gwala base monthly subscription and
// product-listing subscription (1-week / 1-month plans). Fee amounts TBD.
export const gwalaFeeSubscriptions = sqliteTable("gwala_fee_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gwalaId: integer("gwalaId").notNull(),
  kind: text("kind", { enum: ["base", "product_listing"] }).notNull(),
  plan: text("plan", { enum: ["week", "month"] }).notNull(),
  status: text("status", { enum: ["active", "expired", "cancelled"] }).default("active").notNull(),
  amount: text("amount").default("0.00").notNull(),
  startsAt: integer("startsAt", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("endsAt", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
});

// Dairy add-on products a gwala sells (dahi, ghee, makhan, eggs...).
// Publicly listed only while the gwala's product-listing subscription is active.
export const gwalaProducts = sqliteTable("gwala_products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gwalaId: integer("gwalaId").notNull(),
  name: text("name", { length: 120 }).notNull(),
  price: text("price").notNull(),
  unit: text("unit", { length: 40 }).notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: createdAt(),
});

export const productOrders = sqliteTable("product_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customerId").notNull(),
  gwalaId: integer("gwalaId").notNull(),
  productId: integer("productId").notNull(),
  quantity: integer("quantity").notNull(),
  amount: text("amount").notNull(),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
