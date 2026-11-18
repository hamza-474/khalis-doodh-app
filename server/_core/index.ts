import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import fs from "node:fs";
import path from "node:path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { getUserById } from "../db";
import { getUploadsDir } from "../storage";
import { createContext } from "./context";
import { readSessionToken, verifySessionToken } from "./session";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Uploaded verification documents are served only to a signed-in admin
  // (the admin documents viewer uses these URLs).
  app.get("/api/files/*", async (req, res) => {
    try {
      const token = readSessionToken(req);
      const userId = token ? await verifySessionToken(token) : null;
      const user = userId ? await getUserById(userId) : null;
      if (!user || user.role !== "admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const key = decodeURIComponent((req.params as Record<string, string>)[0] ?? "");
      const uploadsRoot = path.resolve(getUploadsDir());
      const filePath = path.resolve(uploadsRoot, key);
      if (!filePath.startsWith(uploadsRoot)) {
        res.status(400).json({ error: "Invalid path" });
        return;
      }
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType =
        ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".pdf" ? "application/pdf" : "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      fs.createReadStream(filePath).pipe(res);
    } catch {
      res.status(500).json({ error: "Failed to read file" });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
