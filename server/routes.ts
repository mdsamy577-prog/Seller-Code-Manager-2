import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSellerSchema, insertSellerApplicationSchema } from "@shared/schema";

const DURATION_DAYS: Record<string, number> = {
  "15_days": 15,
  "1_month": 30,
  "2_months": 60,
  "3_months": 90,
  "4_months": 120,
  "5_months": 150,
  "6_months": 180,
  "7_months": 210,
  "8_months": 240,
  "9_months": 270,
  "10_months": 300,
  "11_months": 330,
  "12_months": 365,
};

const DURATION_CODES: Record<string, string> = {
  "15_days": "15",
  "1_month": "01",
  "2_months": "02",
  "6_months": "06",
};

function calculateExpiryDate(startDate: string, duration: string): string {
  const start = new Date(startDate);
  const days = DURATION_DAYS[duration] || 30;
  start.setDate(start.getDate() + days);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function getNextSerial(): Promise<number> {
  const lastSerial = await storage.getSetting("LAST_SELLER_SERIAL");
  const next = lastSerial ? parseInt(lastSerial) + 1 : 1;
  await storage.setSetting("LAST_SELLER_SERIAL", String(next));
  return next;
}

async function generateSellerCode(joinDate: string, duration: string): Promise<string> {
  const date = new Date(joinDate);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const serial = await getNextSerial();
  const serialStr = String(serial).padStart(3, "0");
  const durationCode = DURATION_CODES[duration] || "01";
  return `${dd}${mm}-${serialStr}${durationCode}`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/sellers", async (_req, res) => {
    try {
      const sellers = await storage.getAllSellers();
      res.json(sellers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sellers" });
    }
  });

  app.get("/api/sellers/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        const sellers = await storage.getAllSellers();
        return res.json(sellers);
      }
      const sellers = await storage.searchSellers(query);
      res.json(sellers);
    } catch (error) {
      res.status(500).json({ message: "Failed to search sellers" });
    }
  });

  app.get("/api/sellers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const seller = await storage.getSellerById(id);
      if (!seller) {
        return res.status(404).json({ message: "Seller not found" });
      }
      res.json(seller);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch seller" });
    }
  });

  app.post("/api/sellers", async (req, res) => {
    try {
      const { name, phone, facebookLink, duration, startDate } = req.body;
      if (!name || !phone || !facebookLink || !duration || !startDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const sellerCode = await generateSellerCode(startDate, duration);
      const expiryDate = calculateExpiryDate(startDate, duration);
      const seller = await storage.createSeller({ name, phone, facebookLink, sellerCode, duration, startDate, expiryDate });
      res.status(201).json(seller);
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(409).json({ message: "Seller code already exists" });
      }
      res.status(500).json({ message: "Failed to create seller" });
    }
  });

  app.patch("/api/sellers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getSellerById(id);
      if (!existing) {
        return res.status(404).json({ message: "Seller not found" });
      }

      const parsed = insertSellerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid seller data", errors: parsed.error.errors });
      }

      const duration = parsed.data.duration;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentExpiry = new Date(existing.expiryDate);
      const baseDate = currentExpiry >= today ? existing.expiryDate : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const expiryDate = calculateExpiryDate(baseDate, duration);

      const seller = await storage.updateSeller(id, { ...parsed.data, expiryDate });
      res.json(seller);
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(409).json({ message: "Seller code already exists" });
      }
      res.status(500).json({ message: "Failed to update seller" });
    }
  });

  app.delete("/api/sellers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteSeller(id);
      if (!deleted) {
        return res.status(404).json({ message: "Seller not found" });
      }
      res.json({ message: "Seller deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete seller" });
    }
  });

  app.get("/api/settings/messenger", async (_req, res) => {
    try {
      const pageName = await storage.getSetting("FACEBOOK_PAGE_NAME");
      res.json({
        configured: !!pageName,
        pageName: pageName || "",
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.get("/api/applications", async (_req, res) => {
    try {
      const applications = await storage.getAllSellerApplications();
      res.json(applications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.post("/api/applications/:id/approve", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid application ID" });
      }
      const application = await storage.getSellerApplicationById(id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      if (application.status !== "pending") {
        return res.status(400).json({ message: `Application already ${application.status}` });
      }

      const today = new Date();
      const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const sellerCode = await generateSellerCode(startDate, application.duration);
      const expiryDate = calculateExpiryDate(startDate, application.duration);

      await storage.createSeller({
        name: application.name,
        phone: application.phone,
        facebookLink: application.facebookLink,
        sellerCode,
        duration: application.duration,
        startDate,
        expiryDate,
      });

      const updated = await storage.updateSellerApplicationStatus(id, "approved");
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to approve application" });
    }
  });

  app.post("/api/applications/:id/reject", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid application ID" });
      }
      const application = await storage.getSellerApplicationById(id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      if (application.status !== "pending") {
        return res.status(400).json({ message: `Application already ${application.status}` });
      }
      const updated = await storage.updateSellerApplicationStatus(id, "rejected");
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to reject application" });
    }
  });

  app.delete("/api/applications/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid application ID" });
      }
      const deleted = await storage.deleteSellerApplication(id);
      if (!deleted) {
        return res.status(404).json({ message: "Application not found" });
      }
      res.json({ message: "Application deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete application" });
    }
  });

  app.post("/api/applications", async (req, res) => {
    try {
      const parsed = insertSellerApplicationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid application data", errors: parsed.error.errors });
      }
      const application = await storage.createSellerApplication(parsed.data);
      res.status(201).json(application);
    } catch (error) {
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  app.post("/api/settings/messenger", async (req, res) => {
    try {
      const { pageName } = req.body;
      if (typeof pageName === "string" && pageName.trim()) {
        await storage.setSetting("FACEBOOK_PAGE_NAME", pageName.trim());
      }
      res.json({ message: "Messenger settings saved successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to save settings" });
    }
  });

  return httpServer;
}
