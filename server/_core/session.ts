import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Request, Response } from "express";
import { jwtVerify, SignJWT } from "jose";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";

// Our own session handling (replaces the Manus SDK session service).
// A signed JWT in an httpOnly cookie carries the user id.

const encoder = new TextEncoder();

function getSecret() {
  if (!ENV.cookieSecret) {
    console.warn(
      "[Auth] JWT_SECRET is not set — using a development-only fallback secret. Set JWT_SECRET before any real deployment."
    );
    return encoder.encode("khalis-doodh-dev-secret-change-me");
  }
  return encoder.encode(ENV.cookieSecret);
}

export async function createSessionToken(userId: number): Promise<string> {
  const issuedAt = Date.now();
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(Math.floor((issuedAt + ONE_YEAR_MS) / 1000))
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const userId = Number((payload as { userId?: unknown }).userId);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}

export function readSessionToken(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === COOKIE_NAME && rest.length) {
        return decodeURIComponent(rest.join("="));
      }
    }
  }
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }
  return null;
}

export async function setSessionCookie(req: Request, res: Response, userId: number) {
  const token = await createSessionToken(userId);
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: ONE_YEAR_MS,
  });
}

export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(req), maxAge: -1 });
}
