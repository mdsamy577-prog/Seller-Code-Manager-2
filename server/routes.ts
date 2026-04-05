import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSellerSchema, insertSellerApplicationSchema } from "@shared/schema";
import passport from "passport";
import { hashPassword, verifyPassword } from "./auth";
import { sendSellerCodeEmail, sendExtensionEmail, sendRenewalApprovalEmail, sendRenewalRejectionEmail } from "./email";
import multer from "multer";
import { uploadNidFile, deleteCloudinaryFile } from "./cloudinary";
import rateLimit from "express-rate-limit";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG and PNG image files are allowed"));
    }
  },
});

const applicationSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many applications submitted. Please try again later." },
});

const nidUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many upload attempts. Please try again later." },
});

const DURATION_MONTHS: Record<string, number> = {
  "1_month": 1,
  "2_months": 2,
  "3_months": 3,
  "4_months": 4,
  "5_months": 5,
  "6_months": 6,
  "7_months": 7,
  "8_months": 8,
  "9_months": 9,
  "10_months": 10,
  "11_months": 11,
  "12_months": 12,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  "11": 11,
  "12": 12,
};

const DURATION_CODES: Record<string, string> = {
  "15_days": "15",
  "1_month": "01",
  "2_months": "02",
  "3_months": "03",
  "4_months": "04",
  "5_months": "05",
  "6_months": "06",
  "7_months": "07",
  "8_months": "08",
  "9_months": "09",
  "10_months": "10",
  "11_months": "11",
  "12_months": "12",
  "1": "01",
  "2": "02",
  "3": "03",
  "4": "04",
  "5": "05",
  "6": "06",
  "7": "07",
  "8": "08",
  "9": "09",
  "10": "10",
  "11": "11",
  "12": "12",
};

function calculateExpiryDate(startDate: string, duration: string): string {
  const [y, m, d] = startDate.split("-").map(Number);
  const start = new Date(y, m - 1, d);

  if (duration === "15_days") {
    start.setDate(start.getDate() + 15);
  } else {
    const months = DURATION_MONTHS[duration] || 1;
    start.setMonth(start.getMonth() + months);
  }

  const ry = start.getFullYear();
  const rm = String(start.getMonth() + 1).padStart(2, "0");
  const rd = String(start.getDate()).padStart(2, "0");
  return `${ry}-${rm}-${rd}`;
}

async function getNextSerial(): Promise<number> {
  return storage.getAndIncrementSerial();
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

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Authentication required" });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/auth/status", async (req, res) => {
    try {
      const userCount = await storage.getUserCount();
      res.json({
        setupRequired: userCount === 0,
        authenticated: req.isAuthenticated(),
        user: req.isAuthenticated() && req.user ? { username: (req.user as any).username } : undefined,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to check auth status" });
    }
  });

  app.post("/api/auth/setup", async (req, res) => {
    try {
      const userCount = await storage.getUserCount();
      if (userCount > 0) {
        return res.status(403).json({ message: "Admin account already exists" });
      }
      const { username, password, recoveryPhrase } = req.body;
      if (!username || !password || !recoveryPhrase) {
        return res.status(400).json({ message: "Username, password, and recovery phrase are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const hashedPassword = hashPassword(password);
      const hashedRecovery = hashPassword(recoveryPhrase);
      await storage.createUser({ username, password: hashedPassword, recoveryPhrase: hashedRecovery });
      res.status(201).json({ message: "Admin account created successfully" });
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(409).json({ message: "Username already exists" });
      }
      res.status(500).json({ message: "Failed to create admin account" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });
      req.logIn(user, (err) => {
        if (err) return next(err);
        return res.json({ message: "Login successful", user: { username: user.username } });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Failed to logout" });
      req.session.destroy((err) => {
        if (err) return res.status(500).json({ message: "Failed to destroy session" });
        res.json({ message: "Logged out successfully" });
      });
    });
  });

  app.post("/api/auth/recover", async (req, res) => {
    try {
      const { recoveryPhrase, newPassword } = req.body;
      if (!recoveryPhrase || !newPassword) {
        return res.status(400).json({ message: "Recovery phrase and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const userCount = await storage.getUserCount();
      if (userCount === 0) {
        return res.status(400).json({ message: "No admin account exists" });
      }
      const allUsers = await storage.getAllUsers();
      let foundUser = null;
      for (const u of allUsers) {
        if (verifyPassword(recoveryPhrase, u.recoveryPhrase)) {
          foundUser = u;
          break;
        }
      }
      if (!foundUser) {
        return res.status(401).json({ message: "Invalid recovery phrase" });
      }
      const hashedPassword = hashPassword(newPassword);
      await storage.updateUserPassword(foundUser.id, hashedPassword);
      res.json({ message: "Password reset successful. You can now login with your new password." });
    } catch (error) {
      res.status(500).json({ message: "Failed to process recovery" });
    }
  });

  app.get("/api/sellers/lookup", async (req, res) => {
    try {
      const q = (req.query.q as string || "").trim();
      if (!q) {
        return res.status(400).json({ message: "Query is required" });
      }
      const byPhone = await storage.getSellerByPhone(q);
      if (byPhone) return res.json(byPhone);
      const byCode = await storage.getSellerByCode(q);
      if (byCode) return res.json(byCode);
      return res.status(404).json({ message: "Seller not found" });
    } catch (error) {
      res.status(500).json({ message: "Failed to lookup seller" });
    }
  });

  app.get("/api/sellers", requireAuth, async (_req, res) => {
    try {
      const sellers = await storage.getAllSellers();
      res.json(sellers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sellers" });
    }
  });

  app.get("/api/sellers/search", requireAuth, async (req, res) => {
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

  app.get("/api/sellers/archived", requireAuth, async (_req, res) => {
    try {
      const deleted = await storage.getDeletedSellers();
      res.json(deleted);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch archived sellers" });
    }
  });

  app.get("/api/sellers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      const seller = await storage.getSellerById(id);
      if (!seller) {
        return res.status(404).json({ message: "Seller not found" });
      }
      res.json(seller);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch seller" });
    }
  });

  app.post("/api/sellers", requireAuth, async (req, res) => {
    try {
      const { name, phone, email, facebookLink, duration, startDate } = req.body;
      if (!name || !phone || !facebookLink || !duration || !startDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const sellerCode = await generateSellerCode(startDate, duration);
      const expiryDate = calculateExpiryDate(startDate, duration);
      const seller = await storage.createSeller({ name, phone, facebookLink, sellerCode, duration, startDate, expiryDate, email: email || undefined });

      if (email) {
        await sendSellerCodeEmail(email, name, sellerCode, startDate, expiryDate);
      }

      res.status(201).json(seller);
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(409).json({ message: "Seller code already exists" });
      }
      res.status(500).json({ message: "Failed to create seller" });
    }
  });

  app.patch("/api/sellers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
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

  app.delete("/api/sellers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      const deleted = await storage.softDeleteSeller(id);
      if (!deleted) {
        return res.status(404).json({ message: "Seller not found" });
      }
      res.json({ message: "Seller moved to archived" });
    } catch (error) {
      res.status(500).json({ message: "Failed to archive seller" });
    }
  });

  app.post("/api/sellers/:id/restore", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      const seller = await storage.restoreSeller(id);
      if (!seller) {
        return res.status(404).json({ message: "Seller not found" });
      }
      res.json(seller);
    } catch (error) {
      res.status(500).json({ message: "Failed to restore seller" });
    }
  });

  app.delete("/api/sellers/:id/permanent", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      const deleted = await storage.deleteSeller(id);
      if (!deleted) {
        return res.status(404).json({ message: "Seller not found" });
      }
      res.json({ message: "Seller permanently deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to permanently delete seller" });
    }
  });

  app.patch("/api/sellers/:id/email", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      const { email } = req.body;
      if (email && (typeof email !== "string" || !email.includes("@"))) {
        return res.status(400).json({ message: "Valid email required" });
      }
      const existing = await storage.getSellerById(id);
      if (!existing) return res.status(404).json({ message: "Seller not found" });
      const updated = await storage.updateSeller(id, { email: email || undefined });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update email" });
    }
  });

  app.post("/api/sellers/:id/resend-email", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      const seller = await storage.getSellerById(id);
      if (!seller) return res.status(404).json({ message: "Seller not found" });
      if (!seller.email) return res.status(400).json({ message: "No email address on file" });
      const sent = await sendSellerCodeEmail(
        seller.email,
        seller.name,
        seller.sellerCode,
        seller.startDate,
        seller.expiryDate
      );
      if (!sent) return res.status(500).json({ message: "Failed to send email" });
      res.json({ message: "Email sent successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to resend email" });
    }
  });

  app.post("/api/sellers/:id/extend", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      const { months } = req.body;

      if (!months || ![1, 3, 6, 12].includes(Number(months))) {
        return res.status(400).json({ message: "Invalid duration. Must be 1, 3, 6, or 12 months." });
      }

      const existing = await storage.getSellerById(id);
      if (!existing) return res.status(404).json({ message: "Seller not found" });

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const baseDate = existing.expiryDate < todayStr ? todayStr : existing.expiryDate;
      const newExpiryDate = calculateExpiryDate(baseDate, String(months));
      const updated = await storage.updateSeller(id, { expiryDate: newExpiryDate });

      if (existing.email) {
        await sendExtensionEmail(
          existing.email,
          existing.name,
          existing.sellerCode,
          existing.expiryDate,
          newExpiryDate,
          Number(months)
        );
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to extend subscription" });
    }
  });

  app.post("/api/renewals", async (req, res) => {
    try {
      const { phone, duration, paymentMethod, senderNumber } = req.body;
      if (!phone || typeof phone !== "string" || !phone.trim()) {
        return res.status(400).json({ message: "phone is required" });
      }
      if (!duration || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(Number(duration))) {
        return res.status(400).json({ message: "Invalid duration. Must be 1–12 months." });
      }
      if (!paymentMethod || !["bkash", "nagad"].includes(paymentMethod)) {
        return res.status(400).json({ message: "paymentMethod must be bkash or nagad" });
      }
      if (!senderNumber || typeof senderNumber !== "string" || !senderNumber.trim()) {
        return res.status(400).json({ message: "senderNumber is required" });
      }
      const seller = await storage.getSellerByPhone(phone.trim());
      if (!seller) {
        return res.status(404).json({ message: "Seller not found" });
      }
      const application = await storage.createRenewalApplication({
        sellerId: seller.id,
        phone: seller.phone,
        duration: String(Number(duration)),
        paymentMethod,
        senderNumber: senderNumber.trim(),
      });
      console.log(`[renewals] New renewal application from ${seller.phone} (seller ID: ${seller.id}), duration: ${duration} months`);
      res.status(201).json({ message: "Renewal application submitted successfully", application });
    } catch (error) {
      res.status(500).json({ message: "Failed to submit renewal application" });
    }
  });

  app.get("/api/renewals", requireAuth, async (_req, res) => {
    try {
      const applications = await storage.getAllRenewalApplications();
      res.json(applications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch renewal applications" });
    }
  });

  app.post("/api/renewals/:id/approve", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) return res.status(400).json({ message: "Invalid application ID" });

      const application = await storage.getRenewalApplicationById(id);
      if (!application) return res.status(404).json({ message: "Renewal application not found" });
      if (application.status !== "pending") {
        return res.status(400).json({ message: `Application already ${application.status}` });
      }

      const seller = await storage.getSellerById(application.sellerId);
      if (!seller) return res.status(404).json({ message: "Seller not found" });

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const baseDate = seller.expiryDate < todayStr ? todayStr : seller.expiryDate;
      const newExpiryDate = calculateExpiryDate(baseDate, application.duration);
      const oldExpiryDate = seller.expiryDate;

      const updates: { expiryDate: string; status?: string } = { expiryDate: newExpiryDate };
      if (seller.status === "deleted") {
        updates.status = "active";
      }
      await storage.updateSeller(seller.id, updates);
      const updated = await storage.updateRenewalApplicationStatus(id, "approved");

      console.log(`[renewals] Approved renewal for ${seller.phone}: ${oldExpiryDate} → ${newExpiryDate}${seller.status === "deleted" ? " (restored from archived)" : ""}`);

      if (seller.email) {
        await sendRenewalApprovalEmail(
          seller.email,
          seller.name,
          seller.sellerCode,
          newExpiryDate
        );
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to approve renewal application" });
    }
  });

  app.post("/api/renewals/:id/reject", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) return res.status(400).json({ message: "Invalid application ID" });

      const application = await storage.getRenewalApplicationById(id);
      if (!application) return res.status(404).json({ message: "Renewal application not found" });
      if (application.status !== "pending") {
        return res.status(400).json({ message: `Application already ${application.status}` });
      }

      const seller = await storage.getSellerById(application.sellerId);

      const updated = await storage.updateRenewalApplicationStatus(id, "rejected");
      console.log(`[renewals] Rejected renewal application ID: ${id}`);

      if (seller?.email) {
        await sendRenewalRejectionEmail(seller.email, seller.name, seller.sellerCode);
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to reject renewal application" });
    }
  });

  app.get("/api/settings/messenger", requireAuth, async (_req, res) => {
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

  app.get("/api/applications", requireAuth, async (_req, res) => {
    try {
      const applications = await storage.getAllSellerApplications();
      res.json(applications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.post("/api/applications/:id/approve", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
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

      const existingSeller = await storage.getSellerByPhone(application.phone);

      let sellerCode: string;
      let startDate: string;
      let expiryDate: string;

      if (existingSeller) {
        sellerCode = existingSeller.sellerCode;
        startDate = existingSeller.startDate;
        expiryDate = existingSeller.expiryDate;
      } else {
        const today = new Date();
        startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        sellerCode = await generateSellerCode(startDate, application.duration);
        expiryDate = calculateExpiryDate(startDate, application.duration);

        await storage.createSeller({
          name: application.name,
          phone: application.phone,
          facebookLink: application.facebookLink,
          sellerCode,
          duration: application.duration,
          startDate,
          expiryDate,
          email: application.email || undefined,
        });
      }

      const updated = await storage.updateSellerApplicationStatus(id, "approved");

      let emailSent = false;
      if (application.email) {
        emailSent = await sendSellerCodeEmail(
          application.email,
          application.name,
          sellerCode,
          startDate,
          expiryDate
        );
      }

      res.json({ ...updated, emailSent });
    } catch (error) {
      console.error("[approve] Error approving application:", error);
      res.status(500).json({ message: "Failed to approve application", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/applications/:id/reject", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
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

      if (application.nidFileUrl) {
        await deleteCloudinaryFile(application.nidFileUrl);
        await storage.clearApplicationNidFileUrl(id);
      }

      const updated = await storage.updateSellerApplicationStatus(id, "rejected");
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to reject application" });
    }
  });

  app.patch("/api/applications/:id/email", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) return res.status(400).json({ message: "Invalid application ID" });

      const { email } = req.body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ message: "Valid email required" });
      }

      const application = await storage.getSellerApplicationById(id);
      if (!application) return res.status(404).json({ message: "Application not found" });

      const updated = await storage.updateSellerApplicationEmail(id, email.trim());

      let emailSent = false;
      if (application.status === "approved") {
        const allSellers = await storage.getAllSellers();
        const seller = allSellers.find(
          (s) => s.name === application.name && s.phone === application.phone
        );
        if (seller) {
          await storage.updateSeller(seller.id, { email: email.trim() });
          emailSent = await sendSellerCodeEmail(
            email.trim(),
            seller.name,
            seller.sellerCode,
            seller.startDate,
            seller.expiryDate
          );
        }
      }

      res.json({ ...updated, emailSent });
    } catch (error) {
      res.status(500).json({ message: "Failed to update email" });
    }
  });

  app.delete("/api/applications/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid application ID" });
      }
      const application = await storage.getSellerApplicationById(id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      if (application.nidFileUrl) {
        await deleteCloudinaryFile(application.nidFileUrl);
        await storage.clearApplicationNidFileUrl(id);
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

  app.post("/api/applications", applicationSubmitLimiter, async (req, res) => {
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

  app.post("/api/applications/upload-nid", nidUploadLimiter, upload.single("nid"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const { phone, name } = req.body;
      if (!phone) {
        return res.status(400).json({ message: "phone is required" });
      }
      const ext = req.file.mimetype === "image/png" ? "png" : "jpg";
      const timestamp = Math.floor(Date.now() / 1000);
      const publicId = `TEMP_${phone}_${timestamp}.${ext}`;
      const secureUrl = await uploadNidFile(
        req.file.buffer,
        req.file.mimetype,
        publicId,
        name || "",
        phone
      );
      res.json({ url: secureUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to upload NID file" });
    }
  });

  app.post("/api/settings/messenger", requireAuth, async (req, res) => {
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

  app.get("/api/settings/email", requireAuth, async (_req, res) => {
    try {
      const senderName = await storage.getSetting("SENDER_NAME");
      const replyEmail = await storage.getSetting("REPLY_EMAIL");
      res.json({
        senderName: senderName || "",
        replyEmail: replyEmail || "",
        hasApiKey: !!process.env.RESEND_API_KEY,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch email settings" });
    }
  });

  app.post("/api/settings/email", requireAuth, async (req, res) => {
    try {
      const { senderName, replyEmail } = req.body;
      await storage.setSetting("SENDER_NAME", (senderName || "").trim());
      await storage.setSetting("REPLY_EMAIL", (replyEmail || "").trim());
      res.json({ message: "Email settings saved successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to save email settings" });
    }
  });

  app.post("/api/settings/email/test", requireAuth, async (req, res) => {
    try {
      const { testEmail } = req.body;
      if (!testEmail) {
        return res.status(400).json({ message: "Test email address is required" });
      }
      const sent = await sendSellerCodeEmail(
        testEmail,
        "Test Seller",
        "TEST-00101",
        new Date().toISOString().split("T")[0],
        new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]
      );
      if (sent) {
        res.json({ message: "Test email sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send test email. Check your email settings." });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to send test email" });
    }
  });

  app.get("/api/settings/group-rules", async (_req, res) => {
    try {
      const rules = await storage.getSetting("GROUP_RULES");
      res.json({ rules: rules || "" });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch group rules" });
    }
  });

  app.post("/api/settings/group-rules", requireAuth, async (req, res) => {
    try {
      const { rules } = req.body;
      await storage.setSetting("GROUP_RULES", rules || "");
      res.json({ message: "Group rules saved successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to save group rules" });
    }
  });

  return httpServer;
}
