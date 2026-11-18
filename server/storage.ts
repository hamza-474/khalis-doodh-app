// Local file storage (replaces the Manus Forge/S3 storage helpers).
// Files are written under <dataDir>/uploads and served back through the
// admin-only /api/files route in server/_core/index.ts.

import { promises as fs } from "node:fs";
import path from "node:path";
import { ENV } from "./_core/env";

export function getDataDir() {
  return ENV.dataDir || path.resolve(process.cwd(), "data");
}

export function getUploadsDir() {
  return path.join(getDataDir(), "uploads");
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "").replace(/\.\.+/g, "_");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const target = path.join(getUploadsDir(), key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const bytes = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as Uint8Array);
  await fs.writeFile(target, bytes);
  return { key, url: `/api/files/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/api/files/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  return `/api/files/${key}`;
}
