import type { Request, Response } from "express";
import app, { initApp } from "./index";

export default async function handler(req: Request, res: Response) {
  await initApp();

  // If Vercel rewrites stripped the '/api' prefix (e.g. /public/verified-sellers),
  // or preserved it (/api/public/verified-sellers), ensure Express sees the correct /api path
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/api/")) {
    const original = req.url;
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
    (req as any).originalUrl = req.url;
  }

  return (app as any)(req, res);
}
