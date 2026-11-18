import { TRPCError } from "@trpc/server";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { users, type User } from "../drizzle/schema";
import { getDb, getUserByEmail } from "./db";
import { ENV } from "./_core/env";
import { setSessionCookie } from "./_core/session";

// Email + password auth for everyone (testing-stage build, per Hamza's spec).
// Signup has two kinds: customer (activates immediately) and gwala (account
// created, then completes enrollment; goes live only after admin approval).
// The admin signs in on a hidden path with ADMIN_EMAIL / ADMIN_PASSWORD.

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function sanitizeUser(user: User) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

async function createAccount(
  req: Request,
  res: Response,
  input: { name: string; email: string; phone?: string; password: string },
  accountType: "customer" | "gwala",
) {
  const email = input.email.trim().toLowerCase();
  const existing = await getUserByEmail(email);
  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "An account with this email already exists. Please sign in instead.",
    });
  }
  const db = await getDb();
  const now = new Date();
  const result = await db.insert(users).values({
    name: input.name.trim(),
    email,
    phone: input.phone?.trim() || null,
    passwordHash: hashPassword(input.password),
    accountType,
    role: "user",
    loginMethod: "email",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  });
  const userId = Number(result.lastInsertRowid);
  await setSessionCookie(req, res, userId);
  const user = await getUserByEmail(email);
  return { success: true as const, user: sanitizeUser(user!) };
}

export async function signupCustomer(
  req: Request,
  res: Response,
  input: { name: string; email: string; phone?: string; password: string },
) {
  return createAccount(req, res, input, "customer");
}

export async function signupGwalaAccount(
  req: Request,
  res: Response,
  input: { name: string; email: string; phone?: string; password: string },
) {
  return createAccount(req, res, input, "gwala");
}

export async function login(
  req: Request,
  res: Response,
  input: { email: string; password: string },
) {
  const email = input.email.trim().toLowerCase();
  const user = await getUserByEmail(email);
  if (!user || user.role === "admin" || !verifyPassword(input.password, user.passwordHash)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
  }
  const db = await getDb();
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  await setSessionCookie(req, res, user.id);
  return { success: true as const, user: sanitizeUser(user) };
}

export async function adminLogin(
  req: Request,
  res: Response,
  input: { email: string; password: string },
) {
  if (!ENV.adminEmail || !ENV.adminPassword) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Admin sign-in is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD.",
    });
  }
  const email = input.email.trim().toLowerCase();
  if (email !== ENV.adminEmail.trim().toLowerCase() || input.password !== ENV.adminPassword) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid admin credentials." });
  }
  const db = await getDb();
  let admin = await getUserByEmail(email);
  if (!admin) {
    const now = new Date();
    const result = await db.insert(users).values({
      name: "Administrator",
      email,
      passwordHash: hashPassword(ENV.adminPassword),
      accountType: "admin",
      role: "admin",
      loginMethod: "admin",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    });
    admin = await getUserByEmail(email);
    if (!admin) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create the admin account." });
    void result;
  }
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, admin.id));
  await setSessionCookie(req, res, admin.id);
  return { success: true as const, user: sanitizeUser(admin) };
}
