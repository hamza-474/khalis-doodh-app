import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import {
  areaWaitlist,
  broadcastAnnouncements,
  cities,
  complaints,
  deliveryRecords,
  gwalaDocuments,
  gwalaFeeSubscriptions,
  gwalaProducts,
  gwalaProfiles,
  gwalaQualityAudits,
  gwalaRatings,
  gwalaServiceAreas,
  khataEntries,
  marketplaceNotifications,
  paymentRecords,
  productOrders,
  referralCredits,
  serviceAreas,
  subscriptions,
  supportTickets,
  users,
} from "../drizzle/schema";
import { getDb, getGwalaByUserId, getSubscriptionForCustomer } from "./db";
import { notifyOwner } from "./_core/notification";
import { storageGetSignedUrl, storagePut } from "./storage";
import { buildDeliveryDates, calculatePlanAmount, deliveryDayCodes, maskCnic, shouldFlagVendor, type DeliveryDayCode, type SubscriptionPlan } from "./marketplaceRules";

type EnrollmentDocument = {
  name: string;
  contentType: "image/jpeg" | "image/png" | "application/pdf";
  dataBase64: string;
};

type DeliveryPhoto = {
  name: string;
  contentType: "image/jpeg" | "image/png";
  dataBase64: string;
};

const allowedDocumentTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Marketplace storage is unavailable. Please try again shortly." });
  }
  return db;
}

function forbidden(message = "You do not have permission to perform this action.") {
  return new TRPCError({ code: "FORBIDDEN", message });
}

function notFound(message: string) {
  return new TRPCError({ code: "NOT_FOUND", message });
}

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

// better-sqlite3 insert results expose lastInsertRowid (MySQL insertId does
// not exist in the SQLite driver).
function insertId(result: unknown): number {
  const row = (Array.isArray(result) ? result[0] : result) as { lastInsertRowid?: number | bigint } | undefined;
  return Number(row?.lastInsertRowid ?? 0);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function currentMonthPrefix() {
  return todayIso().slice(0, 7); // YYYY-MM
}

// LOCKED MODEL badge logic: "Top Rated" at average >= 4.5 with 10+ ratings,
// "New" when the gwala has no ratings yet.
export function gwalaBadge(ratingAverage: string | number, ratingCount: number): "top_rated" | "new" | null {
  if (ratingCount === 0) return "new";
  if (ratingCount >= 10 && toNumber(ratingAverage) >= 4.5) return "top_rated";
  return null;
}

async function getFeeState(db: Awaited<ReturnType<typeof requireDb>>, gwalaId: number) {
  const now = new Date();
  const fees = await db.select().from(gwalaFeeSubscriptions).where(eq(gwalaFeeSubscriptions.gwalaId, gwalaId));
  const active = fees.filter(fee => fee.status === "active" && fee.endsAt > now);
  const base = active.filter(fee => fee.kind === "base").sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0];
  const listing = active.filter(fee => fee.kind === "product_listing").sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0];
  return {
    baseActive: Boolean(base),
    baseEndsAt: base ? base.endsAt.toISOString() : null,
    productListingActive: Boolean(listing),
    productListingEndsAt: listing ? listing.endsAt.toISOString() : null,
  };
}

async function sendOwnerAlert(title: string, body: string) {
  await notifyOwner({ title, content: body }).catch(error => {
    console.warn("[Marketplace] Owner notification failed:", error);
  });
}

export function decodeDocument(document: EnrollmentDocument): Buffer {
  if (!allowedDocumentTypes.has(document.contentType)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only JPG, PNG, and PDF verification documents are accepted." });
  }

  const normalized = document.dataBase64.replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(normalized, "base64");
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Each verification document must be smaller than 5 MB." });
  }
  return bytes;
}

function hashCnic(value: string) {
  return createHash("sha256").update(value.replace(/\D/g, "")).digest("hex");
}

async function upsertServiceArea(cityName: string, areaName: string) {
  const db = await requireDb();
  const existingCity = await db.select().from(cities).where(and(eq(cities.name, cityName), eq(cities.province, "Punjab"))).limit(1);
  const city = existingCity[0] || (await db.insert(cities).values({ name: cityName, province: "Punjab" }), (await db.select().from(cities).where(and(eq(cities.name, cityName), eq(cities.province, "Punjab"))).limit(1))[0]);
  if (!city) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "City could not be saved." });
  const existingArea = await db.select().from(serviceAreas).where(and(eq(serviceAreas.cityId, city.id), eq(serviceAreas.name, areaName))).limit(1);
  if (existingArea[0]) return existingArea[0].id;
  const inserted = await db.insert(serviceAreas).values({ cityId: city.id, name: areaName });
  return insertId(inserted);
}

export async function getPunjabLocationDirectory() {
  const db = await requireDb();
  const cityRows = await db.select().from(cities).where(eq(cities.isActive, true)).orderBy(cities.name);
  const areaRows = await db.select().from(serviceAreas).where(eq(serviceAreas.isActive, true)).orderBy(serviceAreas.name);
  return cityRows.map(city => ({
    id: city.id,
    name: city.name,
    areas: areaRows.filter(area => area.cityId === city.id).map(area => ({ id: area.id, name: area.name, isActive: area.isActive })),
  }));
}

export async function joinAreaWaitlist(input: { city: string; area: string; name?: string; phone?: string; email?: string }) {
  const db = await requireDb();
  const inserted = await db.insert(areaWaitlist).values({ ...input, consentToContact: true });
  const body = `${input.name || "A visitor"} requested coverage for ${input.area}, ${input.city}.`;
  await db.insert(marketplaceNotifications).values({ recipientType: "owner", kind: "waitlist_signup", title: "New area waitlist request", body });
  await sendOwnerAlert("New area waitlist request", body);
  return { waitlistId: insertId(inserted), success: true };
}

export async function listVerifiedGwalas(filters: { city?: string; area?: string }) {
  const db = await requireDb();
  const conditions = [eq(gwalaProfiles.status, "verified"), eq(gwalaServiceAreas.isActive, true)];
  if (filters.city) conditions.push(eq(gwalaServiceAreas.city, filters.city));
  if (filters.area) conditions.push(eq(gwalaServiceAreas.area, filters.area));

  const rows = await db
    .select({
      id: gwalaProfiles.id,
      displayName: gwalaProfiles.displayName,
      city: gwalaServiceAreas.city,
      area: gwalaServiceAreas.area,
      deliverySlots: gwalaServiceAreas.deliverySlots,
      pricePerLitre: gwalaProfiles.pricePerLitre,
      ratingAverage: gwalaProfiles.ratingAverage,
      ratingCount: gwalaProfiles.ratingCount,
      isFeatured: gwalaProfiles.isFeatured,
      qualityStatus: gwalaProfiles.qualityStatus,
    })
    .from(gwalaProfiles)
    .innerJoin(gwalaServiceAreas, eq(gwalaServiceAreas.gwalaId, gwalaProfiles.id))
    .where(and(...conditions))
    .orderBy(desc(gwalaProfiles.isFeatured), desc(gwalaProfiles.ratingAverage));

  // Attach badge + publicly listed products. Products are public only while
  // the gwala's product-listing subscription is active (locked model #3).
  const gwalaIds = Array.from(new Set(rows.map(row => row.id)));
  const feeStates = new Map<number, Awaited<ReturnType<typeof getFeeState>>>();
  for (const gwalaId of gwalaIds) {
    feeStates.set(gwalaId, await getFeeState(db, gwalaId));
  }
  const productRows = gwalaIds.length
    ? await db.select().from(gwalaProducts).where(and(inArray(gwalaProducts.gwalaId, gwalaIds), eq(gwalaProducts.isActive, true)))
    : [];
  return rows.map(row => ({
    ...row,
    badge: gwalaBadge(row.ratingAverage, row.ratingCount),
    products: feeStates.get(row.id)?.productListingActive
      ? productRows.filter(product => product.gwalaId === row.id).map(product => ({ id: product.id, name: product.name, price: product.price, unit: product.unit }))
      : [],
  }));
}

export async function createSubscriptionRequest(
  customerId: number,
  input: {
    gwalaId: number;
    city: string;
    area: string;
    addressLine: string;
    landmark?: string;
    mapLatitude?: number;
    mapLongitude?: number;
    plan: SubscriptionPlan;
    litresPerDay: number;
    deliveryDays: DeliveryDayCode[];
    startDate: string;
    paymentMethod: "cod" | "bank_transfer" | "easypaisa" | "jazzcash" | "card";
  },
) {
  const db = await requireDb();
  const customerRows = await db.select({ accountType: users.accountType }).from(users).where(eq(users.id, customerId)).limit(1);
  if (!customerRows[0] || customerRows[0].accountType !== "customer") {
    throw forbidden("Only customer accounts can subscribe. Gwala accounts cannot buy milk subscriptions.");
  }
  const vendor = await db.select().from(gwalaProfiles).where(eq(gwalaProfiles.id, input.gwalaId)).limit(1);
  const gwala = vendor[0];
  if (!gwala || gwala.status !== "verified") throw notFound("This verified gwala is no longer available.");

  const serviceMatch = await db
    .select()
    .from(gwalaServiceAreas)
    .where(and(eq(gwalaServiceAreas.gwalaId, gwala.id), eq(gwalaServiceAreas.city, input.city), eq(gwalaServiceAreas.area, input.area), eq(gwalaServiceAreas.isActive, true)))
    .limit(1);
  if (!serviceMatch[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "This gwala does not currently serve the selected area." });

  const estimatedAmount = calculatePlanAmount(gwala.pricePerLitre, input.litresPerDay, input.plan, input.deliveryDays);
  const result = await db.insert(subscriptions).values({
    customerId,
    gwalaId: gwala.id,
    city: input.city,
    area: input.area,
    addressLine: input.addressLine,
    landmark: input.landmark || null,
    mapLatitude: input.mapLatitude?.toFixed(7) || null,
    mapLongitude: input.mapLongitude?.toFixed(7) || null,
    plan: input.plan,
    litresPerDay: input.litresPerDay,
    deliveryDays: input.deliveryDays.join(","),
    startDate: input.startDate,
    pricePerLitre: gwala.pricePerLitre,
    estimatedAmount,
    paymentMethod: input.paymentMethod,
    status: "pending",
    paymentStatus: "pending",
  });
  const subscriptionId = insertId(result);
  const deliveryDates = buildDeliveryDates(input.startDate, input.plan, input.deliveryDays);
  await db.insert(deliveryRecords).values(deliveryDates.map(scheduledDate => ({ subscriptionId, scheduledDate })));
  await db.insert(paymentRecords).values({
    subscriptionId,
    amount: estimatedAmount,
    method: input.paymentMethod,
    status: "pending",
    receiptCode: `KD-${subscriptionId}-${Date.now().toString(36).toUpperCase()}`,
  });
  await db.insert(marketplaceNotifications).values({
    recipientUserId: gwala.userId,
    recipientType: "gwala",
    kind: "subscription_request",
    title: "New subscription request",
    body: `A customer in ${input.area}, ${input.city} requested ${input.litresPerDay}L/day on a ${input.plan} plan.`,
  });

  return { subscriptionId, estimatedAmount, status: "pending" as const };
}

export async function getCustomerDashboard(customerId: number) {
  const db = await requireDb();
  const subscriptionRows = await db
    .select({
      id: subscriptions.id,
      gwalaId: subscriptions.gwalaId,
      status: subscriptions.status,
      plan: subscriptions.plan,
      litresPerDay: subscriptions.litresPerDay,
      startDate: subscriptions.startDate,
      paymentMethod: subscriptions.paymentMethod,
      paymentStatus: subscriptions.paymentStatus,
      estimatedAmount: subscriptions.estimatedAmount,
      city: subscriptions.city,
      area: subscriptions.area,
      addressLine: subscriptions.addressLine,
      landmark: subscriptions.landmark,
      mapLatitude: subscriptions.mapLatitude,
      mapLongitude: subscriptions.mapLongitude,
      gwalaName: gwalaProfiles.displayName,
      pricePerLitre: gwalaProfiles.pricePerLitre,
      verified: gwalaProfiles.status,
    })
    .from(subscriptions)
    .innerJoin(gwalaProfiles, eq(gwalaProfiles.id, subscriptions.gwalaId))
    .where(eq(subscriptions.customerId, customerId))
    .orderBy(desc(subscriptions.createdAt));

  const ids = subscriptionRows.map(row => row.id);
  const deliveries = ids.length
    ? await db.select().from(deliveryRecords).where(inArray(deliveryRecords.subscriptionId, ids)).orderBy(desc(deliveryRecords.scheduledDate))
    : [];
  const payments = ids.length
    ? await db.select().from(paymentRecords).where(inArray(paymentRecords.subscriptionId, ids)).orderBy(desc(paymentRecords.createdAt))
    : [];
  const tickets = await db.select().from(supportTickets).where(eq(supportTickets.customerId, customerId)).orderBy(desc(supportTickets.createdAt));
  const userRows = await db.select({ referralCode: users.referralCode }).from(users).where(eq(users.id, customerId)).limit(1);
  let referralCode = userRows[0]?.referralCode;
  if (!referralCode) {
    referralCode = `KD${customerId}${Date.now().toString(36).toUpperCase()}`;
    await db.update(users).set({ referralCode }).where(eq(users.id, customerId));
  }
  const credits = await db.select().from(referralCredits).where(eq(referralCredits.referrerUserId, customerId)).orderBy(desc(referralCredits.createdAt));

  // KHATA: this month's ledger entries with the live total (active entries
  // only — disputed amounts are held out until the admin decides, removed
  // amounts are gone).
  const month = currentMonthPrefix();
  const khataRows = await db
    .select({
      id: khataEntries.id,
      gwalaId: khataEntries.gwalaId,
      entryType: khataEntries.entryType,
      entryDate: khataEntries.entryDate,
      description: khataEntries.description,
      litres: khataEntries.litres,
      rate: khataEntries.rate,
      amount: khataEntries.amount,
      status: khataEntries.status,
      gwalaName: gwalaProfiles.displayName,
    })
    .from(khataEntries)
    .innerJoin(gwalaProfiles, eq(gwalaProfiles.id, khataEntries.gwalaId))
    .where(and(eq(khataEntries.customerId, customerId), sql`substr(${khataEntries.entryDate}, 1, 7) = ${month}`))
    .orderBy(desc(khataEntries.entryDate), desc(khataEntries.id));
  const khataTotal = khataRows.filter(entry => entry.status === "active").reduce((total, entry) => total + toNumber(entry.amount), 0);

  return { subscriptions: subscriptionRows, deliveries, payments, tickets, referral: { code: referralCode, credits }, khata: { month, total: khataTotal.toFixed(2), entries: khataRows } };
}

export async function setSubscriptionStatus(customerId: number, subscriptionId: number, status: "paused" | "active") {
  const subscription = await getSubscriptionForCustomer(subscriptionId, customerId);
  if (!subscription) throw notFound("Subscription not found.");
  if (subscription.status === "declined" || subscription.status === "cancelled") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This subscription cannot be changed." });
  }
  const db = await requireDb();
  await db.update(subscriptions).set({ status }).where(eq(subscriptions.id, subscriptionId));
  return { success: true, status };
}

export async function cancelSubscription(customerId: number, subscriptionId: number, reason?: string) {
  const subscription = await getSubscriptionForCustomer(subscriptionId, customerId);
  if (!subscription) throw notFound("Subscription not found.");
  if (subscription.status === "declined" || subscription.status === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "This subscription cannot be cancelled." });
  const db = await requireDb();
  await db.update(subscriptions).set({ status: "cancelled", cancelledAt: new Date(), cancellationReason: reason || null }).where(eq(subscriptions.id, subscriptionId));
  return { success: true, status: "cancelled" as const };
}

export async function createSupportTicket(customerId: number, input: { subject: string; category: "delivery" | "payment" | "subscription" | "account" | "other"; message: string }) {
  const db = await requireDb();
  const inserted = await db.insert(supportTickets).values({ customerId, ...input });
  const body = `Customer support request: ${input.subject}`;
  await db.insert(marketplaceNotifications).values({ recipientType: "owner", kind: "support_ticket", title: "New customer support ticket", body });
  await sendOwnerAlert("New customer support ticket", body);
  return { ticketId: insertId(inserted), success: true };
}

export async function submitGwalaEnrollment(
  userId: number,
  input: {
    displayName: string;
    phone: string;
    cnic: string;
    city: string;
    area: string;
    routeDescription?: string;
    availability: string;
    deliverySlots: string;
    pricePerLitre: number;
    cnicDocument: EnrollmentDocument;
    areaProofDocument: EnrollmentDocument;
  },
) {
  const existing = await getGwalaByUserId(userId);
  if (existing) throw new TRPCError({ code: "CONFLICT", message: "You already have a gwala enrollment on file." });
  const db = await requireDb();
  const accountRows = await db.select({ accountType: users.accountType }).from(users).where(eq(users.id, userId)).limit(1);
  if (!accountRows[0] || accountRows[0].accountType !== "gwala") {
    throw forbidden("Gwala enrollment needs a gwala account. Please create one with \u201CSign Up as Gwala\u201D first — customer accounts stay customer accounts.");
  }
  const cnicFile = decodeDocument(input.cnicDocument);
  const areaFile = decodeDocument(input.areaProofDocument);
  const cnicFingerprint = hashCnic(input.cnic);
  const duplicateCnic = await db.select({ id: gwalaProfiles.id }).from(gwalaProfiles).where(eq(gwalaProfiles.cnicHash, cnicFingerprint)).limit(1);
  if (duplicateCnic[0]) throw new TRPCError({ code: "CONFLICT", message: "This CNIC already has a gwala enrollment on file." });
  const serviceAreaId = await upsertServiceArea(input.city, input.area);

  const [cnicStored, areaStored] = await Promise.all([
    storagePut(`gwala-verification/${userId}/cnic-${input.cnicDocument.name}`, cnicFile, input.cnicDocument.contentType),
    storagePut(`gwala-verification/${userId}/area-proof-${input.areaProofDocument.name}`, areaFile, input.areaProofDocument.contentType),
  ]);
  const enrollment = await db.insert(gwalaProfiles).values({
    userId,
    displayName: input.displayName,
    phone: input.phone,
    cnicMasked: maskCnic(input.cnic),
    cnicHash: cnicFingerprint,
    city: input.city,
    primaryArea: input.area,
    routeDescription: input.routeDescription || null,
    availability: input.availability,
    pricePerLitre: input.pricePerLitre.toFixed(2),
    status: "pending",
  });
  const gwalaId = insertId(enrollment);
  await db.insert(gwalaServiceAreas).values({
    gwalaId,
    serviceAreaId,
    city: input.city,
    area: input.area,
    deliverySlots: input.deliverySlots,
  });
  await db.insert(gwalaDocuments).values([
    {
      gwalaId,
      documentType: "cnic",
      storageKey: cnicStored.key,
      fileName: input.cnicDocument.name,
      contentType: input.cnicDocument.contentType,
      fileSizeBytes: cnicFile.length,
    },
    {
      gwalaId,
      documentType: "area_proof",
      storageKey: areaStored.key,
      fileName: input.areaProofDocument.name,
      contentType: input.areaProofDocument.contentType,
      fileSizeBytes: areaFile.length,
    },
  ]);
  await db.insert(marketplaceNotifications).values({
    recipientType: "owner",
    kind: "vendor_registration",
    title: "New gwala registration needs review",
    body: `${input.displayName} submitted verification documents for ${input.area}, ${input.city}.`,
  });
  await sendOwnerAlert("New gwala registration needs review", `${input.displayName} submitted a vendor enrollment for ${input.area}, ${input.city}.`);
  return { gwalaId, status: "pending" as const };
}

export async function getGwalaDashboard(userId: number) {
  const db = await requireDb();
  const profile = await getGwalaByUserId(userId);
  if (!profile) throw notFound("No gwala profile is associated with this account.");

  const requests = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      plan: subscriptions.plan,
      litresPerDay: subscriptions.litresPerDay,
      startDate: subscriptions.startDate,
      city: subscriptions.city,
      area: subscriptions.area,
      addressLine: subscriptions.addressLine,
      landmark: subscriptions.landmark,
      mapLatitude: subscriptions.mapLatitude,
      mapLongitude: subscriptions.mapLongitude,
      customerName: users.name,
      customerEmail: users.email,
    })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.customerId))
    .where(eq(subscriptions.gwalaId, profile.id))
    .orderBy(desc(subscriptions.createdAt));
  const subscriptionIds = requests.map(request => request.id);
  const deliveries = subscriptionIds.length
    ? await db.select().from(deliveryRecords).where(inArray(deliveryRecords.subscriptionId, subscriptionIds)).orderBy(desc(deliveryRecords.scheduledDate))
    : [];
  const payments = subscriptionIds.length
    ? await db.select().from(paymentRecords).where(inArray(paymentRecords.subscriptionId, subscriptionIds)).orderBy(desc(paymentRecords.createdAt))
    : [];
  const notifications = await db
    .select()
    .from(marketplaceNotifications)
    .where(and(eq(marketplaceNotifications.recipientUserId, userId), eq(marketplaceNotifications.recipientType, "gwala")))
    .orderBy(desc(marketplaceNotifications.createdAt));
  const activeRequests = requests.filter(request => request.status === "active");
  const expectedMonthlyEarnings = activeRequests.reduce(
    (total, request) => total + toNumber(profile.pricePerLitre) * request.litresPerDay * 30,
    0,
  );

  const fees = await getFeeState(db, profile.id);
  const products = await db.select().from(gwalaProducts).where(eq(gwalaProducts.gwalaId, profile.id)).orderBy(desc(gwalaProducts.createdAt));
  const month = currentMonthPrefix();
  const khataRows = await db
    .select({
      id: khataEntries.id,
      customerId: khataEntries.customerId,
      entryType: khataEntries.entryType,
      entryDate: khataEntries.entryDate,
      description: khataEntries.description,
      litres: khataEntries.litres,
      rate: khataEntries.rate,
      amount: khataEntries.amount,
      status: khataEntries.status,
    })
    .from(khataEntries)
    .where(and(eq(khataEntries.gwalaId, profile.id), sql`substr(${khataEntries.entryDate}, 1, 7) = ${month}`))
    .orderBy(desc(khataEntries.entryDate), desc(khataEntries.id));
  const khataTotal = khataRows.filter(entry => entry.status === "active").reduce((total, entry) => total + toNumber(entry.amount), 0);

  return { profile, requests, deliveries, payments, notifications, expectedMonthlyEarnings: expectedMonthlyEarnings.toFixed(2), fees, products, khata: { month, total: khataTotal.toFixed(2), entries: khataRows } };
}

export async function setSubscriptionRequestStatus(userId: number, subscriptionId: number, decision: "active" | "declined") {
  const profile = await getGwalaByUserId(userId);
  if (!profile) throw forbidden("Only enrolled gwalas can decide subscription requests.");
  const db = await requireDb();
  const request = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
  if (!request[0] || request[0].gwalaId !== profile.id) throw forbidden();
  if (request[0].status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "This request has already been decided." });
  await db.update(subscriptions).set({ status: decision }).where(eq(subscriptions.id, subscriptionId));
  return { success: true, status: decision };
}

export async function markDeliveryStatus(userId: number, deliveryId: number, status: "out_for_delivery" | "delivered" | "missed" | "skipped", proofPhoto?: DeliveryPhoto) {
  const profile = await getGwalaByUserId(userId);
  if (!profile) throw forbidden("Only enrolled gwalas can update delivery records.");
  const db = await requireDb();
  const row = await db
    .select({
      deliveryId: deliveryRecords.id,
      subscriptionId: subscriptions.id,
      gwalaId: subscriptions.gwalaId,
      customerId: subscriptions.customerId,
      litresPerDay: subscriptions.litresPerDay,
      pricePerLitre: subscriptions.pricePerLitre,
      scheduledDate: deliveryRecords.scheduledDate,
      currentStatus: deliveryRecords.status,
    })
    .from(deliveryRecords)
    .innerJoin(subscriptions, eq(subscriptions.id, deliveryRecords.subscriptionId))
    .where(eq(deliveryRecords.id, deliveryId))
    .limit(1);
  if (!row[0] || row[0].gwalaId !== profile.id) throw forbidden();
  let photoStorageKey: string | null = null;
  if (proofPhoto) {
    const bytes = decodeDocument(proofPhoto);
    const stored = await storagePut(`delivery-confirmation/${profile.id}/${deliveryId}-${proofPhoto.name}`, bytes, proofPhoto.contentType);
    photoStorageKey = stored.key;
  }
  await db.update(deliveryRecords).set({
    status,
    completedAt: status === "delivered" ? new Date() : null,
    outForDeliveryAt: status === "out_for_delivery" ? new Date() : null,
    photoStorageKey: photoStorageKey || undefined,
  }).where(eq(deliveryRecords.id, deliveryId));

  // KHATA LEDGER (locked model #5): a delivered delivery creates exactly one
  // ledger entry; money itself moves customer -> gwala directly, the app
  // only records. If the delivery is later un-marked, the entry is removed.
  const existingEntry = await db.select().from(khataEntries).where(eq(khataEntries.deliveryId, deliveryId)).limit(1);
  if (status === "delivered" && !existingEntry[0]) {
    const disputed = await db
      .select({ id: complaints.id })
      .from(complaints)
      .where(and(eq(complaints.deliveryId, deliveryId), inArray(complaints.status, ["open", "in_review"])))
      .limit(1);
    await db.insert(khataEntries).values({
      customerId: row[0].customerId,
      gwalaId: row[0].gwalaId,
      subscriptionId: row[0].subscriptionId,
      deliveryId,
      entryType: "delivery",
      entryDate: row[0].scheduledDate,
      description: `Milk delivery — ${row[0].litresPerDay} litre(s)`,
      litres: row[0].litresPerDay,
      rate: row[0].pricePerLitre,
      amount: (toNumber(row[0].pricePerLitre) * row[0].litresPerDay).toFixed(2),
      status: disputed[0] ? "disputed" : "active",
    });
  }
  if (status !== "delivered" && existingEntry[0] && existingEntry[0].status !== "removed") {
    await db.update(khataEntries).set({ status: "removed" }).where(eq(khataEntries.id, existingEntry[0].id));
  }
  return { success: true };
}

// LOCKED MODEL #9: one rating per customer per gwala per rolling 30 days,
// and only when the customer had at least one delivered delivery from that
// gwala in the same period. Replaces the old per-delivery rating.
export async function submitGwalaRating(customerId: number, input: { gwalaId: number; score: number; comment?: string }) {
  const db = await requireDb();
  const profileRows = await db.select().from(gwalaProfiles).where(eq(gwalaProfiles.id, input.gwalaId)).limit(1);
  const gwala = profileRows[0];
  if (!gwala) throw notFound("Gwala profile not found.");

  const since = daysAgoIso(30);
  const delivered = await db
    .select({ id: deliveryRecords.id })
    .from(deliveryRecords)
    .innerJoin(subscriptions, eq(subscriptions.id, deliveryRecords.subscriptionId))
    .where(and(
      eq(subscriptions.customerId, customerId),
      eq(subscriptions.gwalaId, input.gwalaId),
      eq(deliveryRecords.status, "delivered"),
      gte(deliveryRecords.scheduledDate, since),
    ))
    .limit(1);
  if (!delivered[0]) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "You can rate this gwala after a delivered delivery in the last 30 days." });
  }
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentRating = await db
    .select({ id: gwalaRatings.id })
    .from(gwalaRatings)
    .where(and(eq(gwalaRatings.customerId, customerId), eq(gwalaRatings.gwalaId, input.gwalaId), gte(gwalaRatings.createdAt, cutoff)))
    .limit(1);
  if (recentRating[0]) {
    throw new TRPCError({ code: "CONFLICT", message: "You have already rated this gwala in the last 30 days." });
  }

  await db.insert(gwalaRatings).values({ customerId, gwalaId: input.gwalaId, score: input.score, comment: input.comment || null });

  const allRatings = await db.select({ score: gwalaRatings.score }).from(gwalaRatings).where(eq(gwalaRatings.gwalaId, input.gwalaId));
  const newCount = allRatings.length;
  const newAverage = (allRatings.reduce((total, row) => total + row.score, 0) / newCount).toFixed(2);
  const lowCount = allRatings.filter(row => row.score <= 2).length;
  const flagged = shouldFlagVendor(lowCount, Number(newAverage));
  await db.update(gwalaProfiles).set({
    ratingAverage: newAverage,
    ratingCount: newCount,
    lowRatingFlagCount: lowCount,
    qualityStatus: flagged ? "flagged" : gwala.qualityStatus,
  }).where(eq(gwalaProfiles.id, gwala.id));
  if (flagged && gwala.qualityStatus !== "flagged") {
    const body = `${gwala.displayName} has an average rating of ${newAverage} and requires a quality review.`;
    await db.insert(marketplaceNotifications).values({ recipientType: "owner", kind: "quality_flag", title: "Vendor quality review required", body });
    await sendOwnerAlert("Vendor quality review required", body);
  }
  return { success: true, flagged, badge: gwalaBadge(newAverage, newCount) };
}

// LOCKED MODEL: a single complaint is record-only. The linked khata entry is
// marked disputed until the admin decides. PATTERN RULE: 3+ complaints from
// distinct households against the same gwala within 7 days flags the gwala
// in the admin queue for a deduction decision.
export async function submitComplaint(customerId: number, input: { gwalaId: number; deliveryId?: number; category: "quality" | "late_delivery" | "conduct" | "other"; severity: "standard" | "serious"; details: string }) {
  const db = await requireDb();
  const vendor = await db.select().from(gwalaProfiles).where(eq(gwalaProfiles.id, input.gwalaId)).limit(1);
  if (!vendor[0]) throw notFound("Gwala profile not found.");
  const complaint = await db.insert(complaints).values({ customerId, ...input });

  if (input.deliveryId) {
    await db
      .update(khataEntries)
      .set({ status: "disputed" })
      .where(and(eq(khataEntries.deliveryId, input.deliveryId), eq(khataEntries.status, "active")));
  }

  if (input.severity === "serious") {
    const body = `A serious ${input.category.replace("_", " ")} complaint was submitted about ${vendor[0].displayName}.`;
    await db.insert(marketplaceNotifications).values({ recipientType: "owner", kind: "serious_complaint", title: "Serious customer complaint requires review", body });
    await sendOwnerAlert("Serious customer complaint requires review", body);
  }

  const weekCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = await db
    .select({ customerId: complaints.customerId })
    .from(complaints)
    .where(and(eq(complaints.gwalaId, input.gwalaId), gte(complaints.createdAt, weekCutoff), inArray(complaints.status, ["open", "in_review"])));
  const distinctHouseholds = new Set(recent.map(row => row.customerId)).size;
  let patternFlagged = false;
  if (distinctHouseholds >= 3 && vendor[0].qualityStatus !== "flagged") {
    patternFlagged = true;
    await db.update(gwalaProfiles).set({ qualityStatus: "flagged" }).where(eq(gwalaProfiles.id, input.gwalaId));
    const body = `${vendor[0].displayName} received complaints from ${distinctHouseholds} different households in 7 days — flagged for a khata deduction decision.`;
    await db.insert(marketplaceNotifications).values({ recipientType: "owner", kind: "quality_flag", title: "Complaint pattern flagged", body });
    await sendOwnerAlert("Complaint pattern flagged", body);
  }
  return { complaintId: insertId(complaint), success: true, patternFlagged };
}

// PRODUCTS (locked model #3): customers order a gwala's dairy products into
// the same khata. Money still moves customer -> gwala directly; the app only
// records the order and the ledger entry.
export async function orderProduct(customerId: number, input: { gwalaId: number; productId: number; quantity: number }) {
  const db = await requireDb();
  const customerRows = await db.select({ accountType: users.accountType }).from(users).where(eq(users.id, customerId)).limit(1);
  if (!customerRows[0] || customerRows[0].accountType !== "customer") {
    throw forbidden("Only customer accounts can order products.");
  }
  const productRows = await db.select().from(gwalaProducts).where(eq(gwalaProducts.id, input.productId)).limit(1);
  const product = productRows[0];
  if (!product || product.gwalaId !== input.gwalaId || !product.isActive) throw notFound("This product is not available.");
  const fees = await getFeeState(db, input.gwalaId);
  if (!fees.productListingActive) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This gwala's product listing is not active right now." });
  }
  const amount = (toNumber(product.price) * input.quantity).toFixed(2);
  const order = await db.insert(productOrders).values({ customerId, gwalaId: input.gwalaId, productId: input.productId, quantity: input.quantity, amount });
  const orderId = insertId(order);
  await db.insert(khataEntries).values({
    customerId,
    gwalaId: input.gwalaId,
    productOrderId: orderId,
    entryType: "product",
    entryDate: todayIso(),
    description: `${product.name} × ${input.quantity}`,
    rate: product.price,
    amount,
    status: "active",
  });
  return { orderId, amount, success: true };
}

export async function addGwalaProduct(userId: number, input: { name: string; price: number; unit: string }) {
  const profile = await getGwalaByUserId(userId);
  if (!profile) throw forbidden("Only enrolled gwalas can add products.");
  const db = await requireDb();
  const inserted = await db.insert(gwalaProducts).values({
    gwalaId: profile.id,
    name: input.name.trim(),
    price: input.price.toFixed(2),
    unit: input.unit.trim(),
    isActive: true,
  });
  return { productId: insertId(inserted), success: true };
}

export async function setGwalaProductActive(userId: number, input: { productId: number; isActive: boolean }) {
  const profile = await getGwalaByUserId(userId);
  if (!profile) throw forbidden("Only enrolled gwalas can manage products.");
  const db = await requireDb();
  const rows = await db.select().from(gwalaProducts).where(eq(gwalaProducts.id, input.productId)).limit(1);
  if (!rows[0] || rows[0].gwalaId !== profile.id) throw forbidden();
  await db.update(gwalaProducts).set({ isActive: input.isActive }).where(eq(gwalaProducts.id, input.productId));
  return { success: true };
}

// ADMIN: decide a complaint. "deduct" removes the linked khata amount from
// the customer's khata (the gwala bears the refund, locked model #6);
// "dismiss" closes the complaint and restores any disputed entry.
export async function decideComplaint(input: { complaintId: number; decision: "deduct" | "dismiss" }) {
  const db = await requireDb();
  const rows = await db.select().from(complaints).where(eq(complaints.id, input.complaintId)).limit(1);
  const complaint = rows[0];
  if (!complaint) throw notFound("Complaint not found.");
  if (complaint.decision) throw new TRPCError({ code: "BAD_REQUEST", message: "This complaint has already been decided." });

  if (input.decision === "dismiss") {
    await db.update(complaints).set({ status: "closed", decision: "dismissed", decidedAt: new Date() }).where(eq(complaints.id, input.complaintId));
    if (complaint.deliveryId) {
      await db
        .update(khataEntries)
        .set({ status: "active" })
        .where(and(eq(khataEntries.deliveryId, complaint.deliveryId), eq(khataEntries.status, "disputed")));
    }
    return { success: true, decision: "dismissed" as const, deductedAmount: null as string | null };
  }

  let entry: typeof khataEntries.$inferSelect | undefined;
  if (complaint.deliveryId) {
    const linked = await db.select().from(khataEntries).where(eq(khataEntries.deliveryId, complaint.deliveryId)).limit(1);
    entry = linked[0];
  }
  if (!entry) {
    const candidates = await db
      .select()
      .from(khataEntries)
      .where(and(eq(khataEntries.customerId, complaint.customerId), eq(khataEntries.gwalaId, complaint.gwalaId), inArray(khataEntries.status, ["active", "disputed"])))
      .orderBy(desc(khataEntries.id))
      .limit(1);
    entry = candidates[0];
  }
  if (!entry || entry.status === "removed") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No active khata entry was found to deduct for this complaint." });
  }
  await db.update(khataEntries).set({ status: "removed" }).where(eq(khataEntries.id, entry.id));
  await db.update(complaints).set({ status: "resolved", decision: "deducted", deductedAmount: entry.amount, decidedAt: new Date() }).where(eq(complaints.id, input.complaintId));
  return { success: true, decision: "deducted" as const, deductedAmount: entry.amount as string | null };
}

// ADMIN: record/renew a gwala's platform fee subscription (locked model
// #2/#3). Amounts are TBD by the business — recorded as 0.00 until set.
async function extendFeeSubscription(gwalaId: number, kind: "base" | "product_listing", plan: "week" | "month") {
  const db = await requireDb();
  const profile = await db.select({ id: gwalaProfiles.id }).from(gwalaProfiles).where(eq(gwalaProfiles.id, gwalaId)).limit(1);
  if (!profile[0]) throw notFound("Gwala profile not found.");
  const now = new Date();
  const existing = await db
    .select()
    .from(gwalaFeeSubscriptions)
    .where(and(eq(gwalaFeeSubscriptions.gwalaId, gwalaId), eq(gwalaFeeSubscriptions.kind, kind), eq(gwalaFeeSubscriptions.status, "active")));
  const current = existing.sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0];
  const startsAt = current && current.endsAt > now ? current.endsAt : now;
  const days = plan === "week" ? 7 : 30;
  const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);
  if (current) {
    await db.update(gwalaFeeSubscriptions).set({ endsAt, plan }).where(eq(gwalaFeeSubscriptions.id, current.id));
    return { feeSubscriptionId: current.id, endsAt: endsAt.toISOString(), success: true };
  }
  const inserted = await db.insert(gwalaFeeSubscriptions).values({ gwalaId, kind, plan, status: "active", amount: "0.00", startsAt: now, endsAt });
  return { feeSubscriptionId: insertId(inserted), endsAt: endsAt.toISOString(), success: true };
}

export async function setAdminBaseFee(input: { gwalaId: number }) {
  return extendFeeSubscription(input.gwalaId, "base", "month");
}

export async function setAdminProductListing(input: { gwalaId: number; plan: "week" | "month" }) {
  return extendFeeSubscription(input.gwalaId, "product_listing", input.plan);
}

export async function getAdminOverview() {
  const db = await requireDb();
  const [pendingVendors] = await db.select({ count: sql<number>`count(*)` }).from(gwalaProfiles).where(eq(gwalaProfiles.status, "pending"));
  const [verifiedVendors] = await db.select({ count: sql<number>`count(*)` }).from(gwalaProfiles).where(eq(gwalaProfiles.status, "verified"));
  const [activeSubscriptions] = await db.select({ count: sql<number>`count(*)` }).from(subscriptions).where(eq(subscriptions.status, "active"));
  const [openComplaints] = await db.select({ count: sql<number>`count(*)` }).from(complaints).where(inArray(complaints.status, ["open", "in_review"]));
  const [pendingPayments] = await db.select({ amount: sql<string>`coalesce(sum(${paymentRecords.amount}), 0)` }).from(paymentRecords).where(eq(paymentRecords.status, "pending"));
  const applications = await db.select().from(gwalaProfiles).where(inArray(gwalaProfiles.status, ["pending", "verified", "rejected", "suspended"])).orderBy(desc(gwalaProfiles.createdAt));
  const complaintRows = await db
    .select({ id: complaints.id, category: complaints.category, severity: complaints.severity, details: complaints.details, status: complaints.status, decision: complaints.decision, deductedAmount: complaints.deductedAmount, createdAt: complaints.createdAt, gwalaId: complaints.gwalaId, gwalaName: gwalaProfiles.displayName })
    .from(complaints)
    .innerJoin(gwalaProfiles, eq(gwalaProfiles.id, complaints.gwalaId))
    .orderBy(desc(complaints.createdAt));
  const applicationsWithFees = await Promise.all(applications.map(async application => {
    const fees = await getFeeState(db, application.id);
    return { ...application, baseFeeActive: fees.baseActive, productListingEndsAt: fees.productListingEndsAt };
  }));
  return {
    metrics: {
      pendingVendors: toNumber(pendingVendors?.count),
      verifiedVendors: toNumber(verifiedVendors?.count),
      activeSubscriptions: toNumber(activeSubscriptions?.count),
      openComplaints: toNumber(openComplaints?.count),
      pendingPayments: toNumber(pendingPayments?.amount).toFixed(2),
    },
    applications: applicationsWithFees,
    complaints: complaintRows,
  };
}

export async function getAdminOperations() {
  const db = await requireDb();
  const [locations, waitlist, tickets, broadcasts, audits, allSubscriptions, topVendors] = await Promise.all([
    getPunjabLocationDirectory(),
    db.select().from(areaWaitlist).orderBy(desc(areaWaitlist.createdAt)),
    db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)),
    db.select().from(broadcastAnnouncements).orderBy(desc(broadcastAnnouncements.createdAt)),
    db.select().from(gwalaQualityAudits).orderBy(desc(gwalaQualityAudits.createdAt)),
    db.select({ city: subscriptions.city, status: subscriptions.status, amount: subscriptions.estimatedAmount }).from(subscriptions),
    db.select({ id: gwalaProfiles.id, displayName: gwalaProfiles.displayName, city: gwalaProfiles.city, ratingAverage: gwalaProfiles.ratingAverage, ratingCount: gwalaProfiles.ratingCount, status: gwalaProfiles.status }).from(gwalaProfiles).where(eq(gwalaProfiles.status, "verified")).orderBy(desc(gwalaProfiles.ratingAverage)).limit(5),
  ]);
  const cityStats = Object.values(allSubscriptions.reduce<Record<string, { city: string; activeSubscriptions: number; cancelledSubscriptions: number; estimatedRevenue: number }>>((accumulator, row) => {
    const current = accumulator[row.city] || { city: row.city, activeSubscriptions: 0, cancelledSubscriptions: 0, estimatedRevenue: 0 };
    if (row.status === "active") current.activeSubscriptions += 1;
    if (row.status === "cancelled") current.cancelledSubscriptions += 1;
    current.estimatedRevenue += toNumber(row.amount);
    accumulator[row.city] = current;
    return accumulator;
  }, {}));
  return { locations, waitlist, tickets, broadcasts, audits, cityStats, topVendors };
}

export async function createAdminCity(input: { name: string; province?: string }) {
  const db = await requireDb();
  const existing = await db.select().from(cities).where(and(eq(cities.name, input.name), eq(cities.province, input.province || "Punjab"))).limit(1);
  if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "This city is already listed." });
  const inserted = await db.insert(cities).values({ name: input.name, province: input.province || "Punjab" });
  return { cityId: insertId(inserted), success: true };
}

export async function createAdminServiceArea(input: { cityId: number; name: string }) {
  const db = await requireDb();
  const city = await db.select().from(cities).where(eq(cities.id, input.cityId)).limit(1);
  if (!city[0]) throw notFound("City not found.");
  const existing = await db.select().from(serviceAreas).where(and(eq(serviceAreas.cityId, input.cityId), eq(serviceAreas.name, input.name))).limit(1);
  if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "This service area is already listed." });
  const inserted = await db.insert(serviceAreas).values({ cityId: input.cityId, name: input.name });
  return { serviceAreaId: insertId(inserted), success: true };
}

export async function setAdminServiceAreaStatus(serviceAreaId: number, isActive: boolean) {
  const db = await requireDb();
  await db.update(serviceAreas).set({ isActive }).where(eq(serviceAreas.id, serviceAreaId));
  return { success: true };
}

export async function setSupportTicketStatus(ticketId: number, status: "open" | "in_progress" | "resolved" | "closed") {
  const db = await requireDb();
  await db.update(supportTickets).set({ status }).where(eq(supportTickets.id, ticketId));
  return { success: true };
}

export async function createBroadcast(adminUserId: number, input: { audience: "customers" | "gwalas" | "all"; title: string; message: string; deliveryChannel: "in_app" | "sms_ready" | "whatsapp_ready" }) {
  const db = await requireDb();
  const result = await db.insert(broadcastAnnouncements).values({ ...input, createdByUserId: adminUserId });
  const [allUsers, gwalaUsers] = await Promise.all([
    db.select({ id: users.id }).from(users).where(eq(users.role, "user")),
    db.select({ id: gwalaProfiles.userId }).from(gwalaProfiles),
  ]);
  const gwalaIds = new Set(gwalaUsers.map(row => row.id));
  const customerRecipients = allUsers.filter(row => !gwalaIds.has(row.id)).map(row => ({ id: row.id, recipientType: "customer" as const }));
  const gwalaRecipients = gwalaUsers.map(row => ({ id: row.id, recipientType: "gwala" as const }));
  const recipientRows = input.audience === "customers" ? customerRecipients : input.audience === "gwalas" ? gwalaRecipients : [...customerRecipients, ...gwalaRecipients];
  if (recipientRows.length) await db.insert(marketplaceNotifications).values(recipientRows.map(recipient => ({ recipientUserId: recipient.id, recipientType: recipient.recipientType, kind: "broadcast" as const, title: input.title, body: input.message })));
  return { broadcastId: insertId(result), recipientsQueued: recipientRows.length, success: true };
}

export async function createQualityAudit(input: { gwalaId: number; auditDate: string; auditorName?: string; lactometerReading?: number; notes?: string; status: "planned" | "passed" | "needs_follow_up" }) {
  const db = await requireDb();
  const profile = await db.select({ id: gwalaProfiles.id }).from(gwalaProfiles).where(eq(gwalaProfiles.id, input.gwalaId)).limit(1);
  if (!profile[0]) throw notFound("Gwala profile not found.");
  const inserted = await db.insert(gwalaQualityAudits).values({ ...input, lactometerReading: input.lactometerReading?.toFixed(2) });
  return { auditId: insertId(inserted), success: true };
}

export async function getAdminCsvExport() {
  const db = await requireDb();
  const rows = await db.select({ id: subscriptions.id, city: subscriptions.city, area: subscriptions.area, plan: subscriptions.plan, status: subscriptions.status, amount: subscriptions.estimatedAmount, paymentStatus: subscriptions.paymentStatus, gwalaName: gwalaProfiles.displayName }).from(subscriptions).innerJoin(gwalaProfiles, eq(gwalaProfiles.id, subscriptions.gwalaId)).orderBy(desc(subscriptions.createdAt));
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = ["Subscription ID,City,Area,Gwala,Plan,Status,Payment Status,Estimated Amount", ...rows.map(row => [row.id, row.city, row.area, row.gwalaName, row.plan, row.status, row.paymentStatus, row.amount].map(escape).join(","))].join("\n");
  return { filename: `khalis-doodh-subscriptions-${new Date().toISOString().slice(0, 10)}.csv`, csv };
}

export async function getAdminSystemStatus() {
  const db = await getDb();
  let database = "unavailable" as "healthy" | "unavailable";
  if (db) {
    try {
      await db.select({ count: sql<number>`count(*)` }).from(cities);
      database = "healthy";
    } catch {
      database = "unavailable";
    }
  }
  return {
    application: "healthy" as const,
    database,
    uptimeSeconds: Math.floor(process.uptime()),
    checkedAt: new Date().toISOString(),
    integrations: [
      { name: "SMS / WhatsApp", status: "provider_required" as const },
      { name: "Payment gateways", status: "provider_required" as const },
    ],
  };
}

export async function getAdminDocumentAccess(gwalaId: number) {
  const db = await requireDb();
  const documents = await db.select().from(gwalaDocuments).where(eq(gwalaDocuments.gwalaId, gwalaId));
  if (!documents.length) throw notFound("No verification documents were found for this gwala.");
  return Promise.all(documents.map(async document => ({
    id: document.id,
    documentType: document.documentType,
    fileName: document.fileName,
    contentType: document.contentType,
    uploadedAt: document.createdAt,
    signedUrl: await storageGetSignedUrl(document.storageKey),
  })));
}

export async function reviewGwalaApplication(input: { gwalaId: number; status: "verified" | "rejected" | "suspended"; isFeatured?: boolean; reviewNotes?: string }) {
  const db = await requireDb();
  const profile = await db.select().from(gwalaProfiles).where(eq(gwalaProfiles.id, input.gwalaId)).limit(1);
  if (!profile[0]) throw notFound("Gwala profile not found.");
  await db.update(gwalaProfiles).set({
    status: input.status,
    isFeatured: input.isFeatured ?? profile[0].isFeatured,
    reviewNotes: input.reviewNotes || null,
  }).where(eq(gwalaProfiles.id, input.gwalaId));
  return { success: true };
}

export async function setComplaintStatus(complaintId: number, status: "open" | "in_review" | "resolved" | "closed") {
  const db = await requireDb();
  await db.update(complaints).set({ status }).where(eq(complaints.id, complaintId));
  return { success: true };
}
