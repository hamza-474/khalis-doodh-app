import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addGwalaProduct,
  cancelSubscription,
  createAdminCity,
  createAdminServiceArea,
  createBroadcast,
  createQualityAudit,
  createSupportTicket,
  createSubscriptionRequest,
  decideComplaint,
  getAdminDocumentAccess,
  getAdminOverview,
  getAdminSystemStatus,
  getAdminOperations,
  getAdminCsvExport,
  getCustomerDashboard,
  getGwalaDashboard,
  getPunjabLocationDirectory,
  joinAreaWaitlist,
  listVerifiedGwalas,
  markDeliveryStatus,
  orderProduct,
  reviewGwalaApplication,
  setAdminBaseFee,
  setAdminProductListing,
  setComplaintStatus,
  setAdminServiceAreaStatus,
  setGwalaProductActive,
  setSubscriptionRequestStatus,
  setSubscriptionStatus,
  setSupportTicketStatus,
  submitComplaint,
  submitGwalaEnrollment,
  submitGwalaRating,
} from "./marketplace";
import { adminLogin, login, sanitizeUser, signupCustomer, signupGwalaAccount } from "./auth";
import { chatWithAssistant } from "./ai";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required." });
  }
  return next({ ctx });
});

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");
const cityArea = z.object({ city: z.string().trim().min(2).max(80), area: z.string().trim().min(2).max(120) });
const deliveryDay = z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
const documentInput = z.object({
  name: z.string().trim().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  dataBase64: z.string().min(20).max(7_000_000),
});
const deliveryPhotoInput = documentInput.extend({ contentType: z.enum(["image/jpeg", "image/png"]) });

const signupInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().regex(/^\+?[0-9\-\s]{10,20}$/, "Enter a valid phone number.").optional(),
  password: z.string().min(8).max(128),
});
const loginInput = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128),
});

export const appRouter = router({
  system: systemRouter,
  ai: router({
    // Public AI support chat (Stage C). Identity for the daily cap is the
    // signed-in user id, otherwise the caller IP.
    chat: publicProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(2000),
        })).min(1).max(20),
      }))
      .mutation(({ ctx, input }) => {
        const forwarded = ctx.req.headers["x-forwarded-for"];
        const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0])?.trim()
          || ctx.req.ip
          || "unknown";
        const identity = ctx.user ? `user:${ctx.user.id}` : `ip:${ip}`;
        return chatWithAssistant(identity, input.messages);
      }),
  }),
  auth: router({
    me: publicProcedure.query(opts => (opts.ctx.user ? sanitizeUser(opts.ctx.user) : null)),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    // Email + password auth. Two signup kinds (separate-accounts rule):
    // customer accounts activate immediately; gwala accounts then complete
    // enrollment and go live only after admin approval.
    signupCustomer: publicProcedure.input(signupInput).mutation(({ ctx, input }) => signupCustomer(ctx.req, ctx.res, input)),
    signupGwala: publicProcedure.input(signupInput).mutation(({ ctx, input }) => signupGwalaAccount(ctx.req, ctx.res, input)),
    login: publicProcedure.input(loginInput).mutation(({ ctx, input }) => login(ctx.req, ctx.res, input)),
    // Hidden admin sign-in (ADMIN_EMAIL / ADMIN_PASSWORD env vars).
    adminLogin: publicProcedure.input(loginInput).mutation(({ ctx, input }) => adminLogin(ctx.req, ctx.res, input)),
  }),
  marketplace: router({
    discover: publicProcedure.input(cityArea.partial()).query(({ input }) => listVerifiedGwalas(input)),
    locations: publicProcedure.query(() => getPunjabLocationDirectory()),
    waitlist: publicProcedure.input(cityArea.extend({
      name: z.string().trim().min(2).max(120).optional(),
      phone: z.string().trim().regex(/^\+?[0-9\-\s]{10,20}$/, "Enter a valid phone number.").optional(),
      email: z.string().trim().email().max(320).optional(),
    }).refine(input => Boolean(input.phone || input.email), { message: "Add a phone number or email so we can contact you." })).mutation(({ input }) => joinAreaWaitlist(input)),
    subscriptions: router({
      create: protectedProcedure.input(cityArea.extend({
        gwalaId: z.number().int().positive(),
        addressLine: z.string().trim().min(5).max(255),
        landmark: z.string().trim().max(180).optional(),
        mapLatitude: z.number().min(-90).max(90).optional(),
        mapLongitude: z.number().min(-180).max(180).optional(),
        plan: z.enum(["weekly", "monthly"]),
        litresPerDay: z.number().int().min(1).max(20),
        deliveryDays: z.array(deliveryDay).min(1).max(7).default(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]),
        startDate: dateString,
        paymentMethod: z.enum(["cod", "bank_transfer", "easypaisa", "jazzcash", "card"]),
      })).mutation(({ ctx, input }) => createSubscriptionRequest(ctx.user.id, input)),
      mine: protectedProcedure.query(({ ctx }) => getCustomerDashboard(ctx.user.id)),
      setStatus: protectedProcedure.input(z.object({ subscriptionId: z.number().int().positive(), status: z.enum(["paused", "active"]) })).mutation(({ ctx, input }) => setSubscriptionStatus(ctx.user.id, input.subscriptionId, input.status)),
      cancel: protectedProcedure.input(z.object({ subscriptionId: z.number().int().positive(), reason: z.string().trim().max(500).optional() })).mutation(({ ctx, input }) => cancelSubscription(ctx.user.id, input.subscriptionId, input.reason)),
      createSupportTicket: protectedProcedure.input(z.object({ subject: z.string().trim().min(4).max(180), category: z.enum(["delivery", "payment", "subscription", "account", "other"]), message: z.string().trim().min(10).max(2000) })).mutation(({ ctx, input }) => createSupportTicket(ctx.user.id, input)),
      rateGwala: protectedProcedure.input(z.object({ gwalaId: z.number().int().positive(), score: z.number().int().min(1).max(5), comment: z.string().trim().max(600).optional() })).mutation(({ ctx, input }) => submitGwalaRating(ctx.user.id, input)),
      orderProduct: protectedProcedure.input(z.object({ gwalaId: z.number().int().positive(), productId: z.number().int().positive(), quantity: z.number().int().min(1).max(100) })).mutation(({ ctx, input }) => orderProduct(ctx.user.id, input)),
      complain: protectedProcedure.input(z.object({
        gwalaId: z.number().int().positive(),
        deliveryId: z.number().int().positive().optional(),
        category: z.enum(["quality", "late_delivery", "conduct", "other"]),
        severity: z.enum(["standard", "serious"]),
        details: z.string().trim().min(8).max(2000),
      })).mutation(({ ctx, input }) => submitComplaint(ctx.user.id, input)),
    }),
    gwala: router({
      enroll: protectedProcedure.input(cityArea.extend({
        displayName: z.string().trim().min(2).max(120),
        phone: z.string().trim().regex(/^\+?[0-9\-\s]{10,20}$/, "Enter a valid phone number."),
        cnic: z.string().trim().regex(/^[0-9]{5}-?[0-9]{7}-?[0-9]$/, "Enter a valid CNIC."),
        routeDescription: z.string().trim().max(600).optional(),
        availability: z.string().trim().min(4).max(180),
        deliverySlots: z.string().trim().min(4).max(180),
        pricePerLitre: z.number().min(1).max(10000),
        cnicDocument: documentInput,
        areaProofDocument: documentInput,
      })).mutation(({ ctx, input }) => submitGwalaEnrollment(ctx.user.id, input)),
      dashboard: protectedProcedure.query(({ ctx }) => getGwalaDashboard(ctx.user.id)),
      decideRequest: protectedProcedure.input(z.object({ subscriptionId: z.number().int().positive(), decision: z.enum(["active", "declined"]) })).mutation(({ ctx, input }) => setSubscriptionRequestStatus(ctx.user.id, input.subscriptionId, input.decision)),
      markDelivery: protectedProcedure.input(z.object({ deliveryId: z.number().int().positive(), status: z.enum(["out_for_delivery", "delivered", "missed", "skipped"]), proofPhoto: deliveryPhotoInput.optional() })).mutation(({ ctx, input }) => markDeliveryStatus(ctx.user.id, input.deliveryId, input.status, input.proofPhoto)),
      addProduct: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120), price: z.number().positive().max(100000), unit: z.string().trim().min(1).max(40) })).mutation(({ ctx, input }) => addGwalaProduct(ctx.user.id, input)),
      setProductActive: protectedProcedure.input(z.object({ productId: z.number().int().positive(), isActive: z.boolean() })).mutation(({ ctx, input }) => setGwalaProductActive(ctx.user.id, input)),
    }),
    admin: router({
      overview: adminProcedure.query(() => getAdminOverview()),
      systemStatus: adminProcedure.query(() => getAdminSystemStatus()),
      operations: adminProcedure.query(() => getAdminOperations()),
      exportSubscriptions: adminProcedure.query(() => getAdminCsvExport()),
      gwalaDocuments: adminProcedure.input(z.object({ gwalaId: z.number().int().positive() })).query(({ input }) => getAdminDocumentAccess(input.gwalaId)),
      reviewGwala: adminProcedure.input(z.object({
        gwalaId: z.number().int().positive(),
        status: z.enum(["verified", "rejected", "suspended"]),
        isFeatured: z.boolean().optional(),
        reviewNotes: z.string().trim().max(1000).optional(),
      })).mutation(({ input }) => reviewGwalaApplication(input)),
      setComplaintStatus: adminProcedure.input(z.object({ complaintId: z.number().int().positive(), status: z.enum(["open", "in_review", "resolved", "closed"]) })).mutation(({ input }) => setComplaintStatus(input.complaintId, input.status)),
      decideComplaint: adminProcedure.input(z.object({ complaintId: z.number().int().positive(), decision: z.enum(["deduct", "dismiss"]) })).mutation(({ input }) => decideComplaint(input)),
      setBaseFee: adminProcedure.input(z.object({ gwalaId: z.number().int().positive() })).mutation(({ input }) => setAdminBaseFee(input)),
      setProductListing: adminProcedure.input(z.object({ gwalaId: z.number().int().positive(), plan: z.enum(["week", "month"]) })).mutation(({ input }) => setAdminProductListing(input)),
      createCity: adminProcedure.input(z.object({ name: z.string().trim().min(2).max(80), province: z.string().trim().min(2).max(80).default("Punjab") })).mutation(({ input }) => createAdminCity(input)),
      createServiceArea: adminProcedure.input(z.object({ cityId: z.number().int().positive(), name: z.string().trim().min(2).max(120) })).mutation(({ input }) => createAdminServiceArea(input)),
      setServiceAreaStatus: adminProcedure.input(z.object({ serviceAreaId: z.number().int().positive(), isActive: z.boolean() })).mutation(({ input }) => setAdminServiceAreaStatus(input.serviceAreaId, input.isActive)),
      setSupportTicketStatus: adminProcedure.input(z.object({ ticketId: z.number().int().positive(), status: z.enum(["open", "in_progress", "resolved", "closed"]) })).mutation(({ input }) => setSupportTicketStatus(input.ticketId, input.status)),
      createBroadcast: adminProcedure.input(z.object({ audience: z.enum(["customers", "gwalas", "all"]), title: z.string().trim().min(4).max(180), message: z.string().trim().min(10).max(2000), deliveryChannel: z.enum(["in_app", "sms_ready", "whatsapp_ready"]) })).mutation(({ ctx, input }) => createBroadcast(ctx.user.id, input)),
      createQualityAudit: adminProcedure.input(z.object({ gwalaId: z.number().int().positive(), auditDate: dateString, auditorName: z.string().trim().max(120).optional(), lactometerReading: z.number().min(0).max(100).optional(), notes: z.string().trim().max(2000).optional(), status: z.enum(["planned", "passed", "needs_follow_up"]) })).mutation(({ input }) => createQualityAudit(input)),
    }),
  }),
});

export type AppRouter = typeof appRouter;
