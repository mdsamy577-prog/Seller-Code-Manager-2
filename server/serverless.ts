import type { Request, Response } from "express";
import app, { initApp } from "./index";

export default async function handler(req: Request, res: Response) {
  await initApp();
  return (app as any)(req, res);
}
