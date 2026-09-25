import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSellerSchema, insertSellerApplicationSchema, type Seller } from "@shared/schema";
import passport from "passport";
import { hashPassword, verifyPassword, generateAuthToken } from "./auth";
import { sendSellerCodeEmail, sendExtensionEmail, sendRenewalApprovalEmail, sendRenewalRejectionEmail } from "./email";
import { scheduleSellerEmails } from "./scheduler";
import multer from "multer";
import { uploadNidFile, uploadProfilePhoto, deleteCloudinaryFile } from "./cloudinary";
import rateLimit from "express-rate-limit";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and WEBP image files are allowed"));
    }
  },
});

const uploadJpg = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isJpg = file.mimetype === "image/jpeg" || /\.(jpe?g)$/i.test(file.originalname);
    if (isJpg) {
      cb(null, true);
    } else {
      cb(new Error("শুধুমাত্র JPG বা JPEG ফরম্যাটের ছবি গ্রহণযোগ্য।"));
    }
  },
});

function uploadJpgMiddleware(req: Request, res: Response, next: NextFunction) {
  uploadJpg.single("photo")(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ message: err.message || "শুধুমাত্র JPG বা JPEG ফরম্যাটের ছবি গ্রহণযোগ্য।" });
    }
    next();
  });
}

const photoUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many photo uploads. Please try again later." },
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
  const durationCode = DURATION_CODES[duration] || "01";

  let sellerCode: string;
  let attempts = 0;
  do {
    const serial = await getNextSerial();
    const serialStr = String(serial).padStart(3, "0");
    sellerCode = `${dd}${mm}-${serialStr}${durationCode}`;
    const existing = await storage.getSellerByCode(sellerCode);
    if (!existing) break;
    attempts++;
  } while (attempts < 100);

  return sellerCode;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const isAuthenticated = !!(req.isAuthenticated && req.isAuthenticated()) || !!req.user;
  if (!isAuthenticated) {
    return res.status(401).json({ message: "Authentication required" });
  }
  return next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/auth/status", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    try {
      const userCount = await storage.getUserCount();
      const setupRequired = userCount === 0;
      const isAuthenticated = !!(req.isAuthenticated && req.isAuthenticated()) || !!req.user;
      res.json({
        setupRequired,
        authenticated: isAuthenticated,
        user: isAuthenticated ? { username: (req.user as any)?.username || "Admin" } : null,
      });
    } catch {
      res.json({
        setupRequired: false,
        authenticated: false,
        user: null,
      });
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
      const user = await storage.createUser({ username, password: hashedPassword, recoveryPhrase: hashedRecovery });
      const token = generateAuthToken(user.id, user.username);
      req.logIn(user, () => {
        res.status(201).json({ message: "Admin account created successfully", token, user: { username: user.username } });
      });
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
        const token = generateAuthToken(user.id, user.username);
        return res.json({ message: "Login successful", token, user: { username: user.username } });
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

  // --- Public Safe Verification Endpoints ---
  app.get("/api/public/verified-sellers", async (_req, res) => {
    try {
      const activeSellers = await storage.getAllSellers();
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const filtered = activeSellers.filter((s) => {
        if (s.status !== "active") return false;
        if (!s.expiryDate) return false;
        // Strictly exclude sellers whose expiry date has arrived or passed
        const isDateExpired = s.expiryDate <= todayStr || new Date(s.expiryDate).getTime() <= now.getTime();
        if (isDateExpired) {
          // Asynchronously move expired sellers to deleted/archived
          storage.softDeleteSeller(s.id).catch(() => {});
          return false;
        }
        return true;
      });

      const sanitized = filtered.map((s) => ({
        id: s.id,
        name: s.name,
        sellerCode: s.sellerCode,
        facebookLink: s.facebookLink,
        status: s.status,
        duration: s.duration,
        startDate: s.startDate,
        expiryDate: s.expiryDate,
        profileImage: s.profileImage || null,
      }));
      res.json(sanitized);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch verified sellers" });
    }
  });

  app.get("/api/public/verify/:code", async (req, res) => {
    try {
      const rawCode = (req.params.code || "").trim();
      if (!rawCode) {
        return res.status(400).json({
          found: false,
          isValid: false,
          isVerified: false,
          isExpired: false,
          message: "Seller code is required"
        });
      }

      // Find seller by code in storage (including archived/soft-deleted records)
      let seller = await storage.getSellerByCode(rawCode);
      if (!seller) {
        // Fallback for whitespace or lowercase match
        const active = await storage.getAllSellers();
        const deleted = await storage.getDeletedSellers();
        seller = [...active, ...deleted].find(
          (s) => s.sellerCode.trim().toLowerCase() === rawCode.toLowerCase()
        );
      }

      if (!seller) {
        return res.json({
          found: false,
          isValid: false,
          isVerified: false,
          isExpired: false,
          message: "No seller found matching this code."
        });
      }

      // Compute real-time expiration: compare seller.expiryDate with the current date
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const isDateExpired = !seller.expiryDate || seller.expiryDate <= todayStr || new Date(seller.expiryDate).getTime() <= now.getTime();

      const phone = seller.phone || "";
      const maskedPhone = phone.length > 5
        ? `${phone.slice(0, 3)}***${phone.slice(-3)}`
        : "***";

      const email = seller.email || "";
      let maskedEmail = "";
      if (email && email.includes("@")) {
        const [u, d] = email.split("@");
        const prefix = u.length > 2 ? u.slice(0, 2) : u.slice(0, 1);
        maskedEmail = `${prefix}***@${d}`;
      } else {
        const slug = (seller.name || "seller").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 2) || "md";
        maskedEmail = `${slug}***@gmail.com`;
      }

      // If seller.status !== 'active' OR isDateExpired is TRUE:
      // The response MUST return isValid: false, isExpired: true, status: 'expired'
      // DO NOT return isValid: true for any expired seller under any circumstances!
      if (seller.status !== "active" || isDateExpired) {
        // Ensure status in database is synchronized to deleted/archived
        if (seller.status === "active") {
          storage.softDeleteSeller(seller.id).catch(() => {});
        }

        const shouldHide = Boolean(seller.hideProfilePhoto);

        return res.json({
          found: true,
          isValid: false,
          isVerified: false,
          isExpired: true,
          status: "expired",
          message: "সতর্কতা: এই সেলারের কোডের মেয়াদ উত্তীর্ণ হয়ে গেছে। এই কোডের অধীনে কোনো লেনদেন করবেন না।",
          seller: {
            id: seller.id,
            name: seller.name,
            sellerCode: seller.sellerCode,
            facebookLink: seller.facebookLink,
            status: "expired",
            duration: seller.duration,
            startDate: seller.startDate,
            expiryDate: seller.expiryDate,
            maskedPhone,
            maskedEmail,
            profileImage: shouldHide ? null : (seller.profileImage || null),
            hideProfilePhoto: shouldHide,
            sellerType: (seller as any).sellerType || (seller.facebookLink?.includes("page") ? "facebook_business_page" : "personal_facebook_id"),
          }
        });
      }

      // Active and strictly non-expired seller
      const shouldHide = Boolean(seller.hideProfilePhoto);
      return res.json({
        found: true,
        isValid: true,
        isVerified: true,
        isExpired: false,
        status: "active",
        seller: {
          id: seller.id,
          name: seller.name,
          sellerCode: seller.sellerCode,
          facebookLink: seller.facebookLink,
          status: "active",
          duration: seller.duration,
          startDate: seller.startDate,
          expiryDate: seller.expiryDate,
          maskedPhone,
          maskedEmail,
          profileImage: shouldHide ? null : (seller.profileImage || null),
          hideProfilePhoto: shouldHide,
          sellerType: (seller as any).sellerType || (seller.facebookLink?.includes("page") ? "facebook_business_page" : "personal_facebook_id"),
        }
      });
    } catch (error) {
      res.status(500).json({
        found: false,
        isValid: false,
        isVerified: false,
        isExpired: false,
        message: "Verification check failed"
      });
    }
  });

  app.get("/api/public/search", async (req, res) => {
    try {
      const query = (req.query.q as string || "").trim();
      if (!query) {
        return res.json({ results: [] });
      }

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const formatPublicResult = (s: any) => {
        const isDateExpired = !s.expiryDate || s.expiryDate <= todayStr || new Date(s.expiryDate).getTime() <= now.getTime();
        const isExpired = s.status !== "active" || isDateExpired;
        const phone = s.phone || "";
        const maskedPhone = phone.length > 5
          ? `${phone.slice(0, 3)}***${phone.slice(-3)}`
          : "***";

        const email = s.email || "";
        let maskedEmail = "";
        if (email && email.includes("@")) {
          const [u, d] = email.split("@");
          const prefix = u.length > 2 ? u.slice(0, 2) : u.slice(0, 1);
          maskedEmail = `${prefix}***@${d}`;
        } else {
          const slug = (s.name || "seller").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 2) || "md";
          maskedEmail = `${slug}***@gmail.com`;
        }

        const shouldHide = Boolean(s.hideProfilePhoto);
        return {
          id: s.id,
          name: s.name,
          sellerCode: s.sellerCode,
          facebookLink: s.facebookLink,
          status: isExpired ? "expired" : "active",
          startDate: s.startDate,
          expiryDate: s.expiryDate,
          isValid: !isExpired,
          isVerified: !isExpired,
          isExpired,
          maskedPhone,
          maskedEmail,
          profileImage: shouldHide ? null : (s.profileImage || null),
          hideProfilePhoto: shouldHide,
          sellerType: (s as any).sellerType || (s.facebookLink?.includes("page") ? "facebook_business_page" : "personal_facebook_id"),
        };
      };

      const byCode = await storage.getSellerByCode(query);
      if (byCode) {
        return res.json({
          results: [formatPublicResult(byCode)]
        });
      }

      const byPhone = await storage.getSellerByPhone(query);
      if (byPhone) {
        return res.json({
          results: [formatPublicResult(byPhone)]
        });
      }

      const allActive = await storage.getAllSellers();
      const allDeleted = await storage.getDeletedSellers();
      const allSellers = [...allActive, ...allDeleted];
      const qLower = query.toLowerCase();
      const matched = allSellers
        .filter(s => s.name.toLowerCase().includes(qLower) || s.sellerCode.toLowerCase().includes(qLower))
        .slice(0, 12);

      return res.json({
        results: matched.map(formatPublicResult)
      });
    } catch (error) {
      res.status(500).json({ results: [], message: "Search failed" });
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

  const handleGetSellers = async (_req: Request, res: Response) => {
    try {
      const sellers = await storage.getAllSellers();
      res.json(sellers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sellers" });
    }
  };

  app.get("/api/sellers", requireAuth, handleGetSellers);
  app.get("/api/admin/sellers", requireAuth, handleGetSellers);

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

  app.get("/api/sellers/next-emails", requireAuth, async (_req, res) => {
    try {
      const nextEmails = await storage.getNextPendingEmailPerSeller();
      res.json(nextEmails);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch next email times" });
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
      const { name, phone, email, facebookLink, duration, startDate, profileImage } = req.body;
      if (!name || !phone || !facebookLink || !duration || !startDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const sellerCode = await generateSellerCode(startDate, duration);
      const expiryDate = calculateExpiryDate(startDate, duration);
      const seller = await storage.createSeller({
        name,
        phone,
        facebookLink,
        sellerCode,
        duration,
        startDate,
        expiryDate,
        email: email || undefined,
        profileImage: profileImage || undefined,
      });

      if (email) {
        await sendSellerCodeEmail(email, name, sellerCode, startDate, expiryDate);
      }

      await scheduleSellerEmails(seller);

      res.status(201).json(seller);
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(409).json({ message: "Seller code already exists" });
      }
      res.status(500).json({ message: "Failed to create seller" });
    }
  });

  const handleUpdateSeller = async (req: Request, res: Response) => {
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

      // If a seller updates their photo during a profile edit, automatically delete the old photo from Cloudinary
      if (
        parsed.data.profileImage !== undefined &&
        existing.profileImage &&
        parsed.data.profileImage !== existing.profileImage
      ) {
        console.log(`[Storage] Seller photo changed for ID ${id}, deleting old photo: ${existing.profileImage}`);
        await deleteCloudinaryFile(existing.profileImage);
      }

      const duration = parsed.data.duration;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentExpiry = new Date(existing.expiryDate);
      const baseDate = currentExpiry >= today ? existing.expiryDate : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const expiryDate = calculateExpiryDate(baseDate, duration);

      const seller = await storage.updateSeller(id, { ...parsed.data, expiryDate });
      if (seller) {
        await scheduleSellerEmails(seller);
      }
      res.json(seller);
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(409).json({ message: "Seller code already exists" });
      }
      res.status(500).json({ message: "Failed to update seller" });
    }
  };

  app.patch("/api/sellers/:id", requireAuth, handleUpdateSeller);
  app.patch("/api/admin/sellers/:id", requireAuth, handleUpdateSeller);

  const handlePermanentDeleteSeller = async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) return res.status(400).json({ message: "Invalid seller ID" });

      const seller = await storage.getSellerById(id);
      if (!seller) {
        return res.status(404).json({ message: "Seller not found" });
      }

      // Retrieve all stored image URLs and purge them from Cloudinary
      const imagesToPurge: string[] = [];
      if (seller.profileImage) imagesToPurge.push(seller.profileImage);
      if ((seller as any).sellerPhoto) imagesToPurge.push((seller as any).sellerPhoto);
      if ((seller as any).nidImage) imagesToPurge.push((seller as any).nidImage);
      if ((seller as any).nidFileUrl) imagesToPurge.push((seller as any).nidFileUrl);

      for (const imgUrl of imagesToPurge) {
        await deleteCloudinaryFile(imgUrl);
      }

      await storage.cancelPendingEmailsForSeller(id);
      const deleted = await storage.deleteSeller(id);
      if (!deleted) {
        return res.status(404).json({ message: "Seller not found" });
      }
      res.json({ message: "Seller permanently deleted" });
    } catch (error) {
      console.error("[permanent delete] Error deleting seller:", error);
      res.status(500).json({ message: "Failed to permanently delete seller" });
    }
  };

  app.delete("/api/sellers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (req.query.permanent === "true") {
        return handlePermanentDeleteSeller(req, res);
      }
      const deleted = await storage.softDeleteSeller(id);
      if (!deleted) {
        return res.status(404).json({ message: "Seller not found" });
      }
      await storage.cancelPendingEmailsForSeller(id);
      res.json({ message: "Seller moved to archived" });
    } catch (error) {
      res.status(500).json({ message: "Failed to archive seller" });
    }
  });

  app.delete("/api/admin/sellers/:id", requireAuth, handlePermanentDeleteSeller);
  app.delete("/api/admin/sellers/:id/permanent", requireAuth, handlePermanentDeleteSeller);
  app.delete("/api/sellers/:id/permanent", requireAuth, handlePermanentDeleteSeller);

  app.post("/api/sellers/:id/restore", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      const seller = await storage.restoreSeller(id);
      if (!seller) {
        return res.status(404).json({ message: "Seller not found" });
      }
      if (seller.email) {
        await scheduleSellerEmails(seller);
      }
      res.json(seller);
    } catch (error) {
      res.status(500).json({ message: "Failed to restore seller" });
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

      if (updated) {
        await scheduleSellerEmails(updated);
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to extend subscription" });
    }
  });

  app.post("/api/renewals", async (req, res) => {
    try {
      const { phone, duration, paymentMethod, senderNumber, profileImage } = req.body;
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

      // If renewal includes a profile photo, update seller record in database automatically
      if (profileImage && typeof profileImage === "string" && profileImage.trim()) {
        await storage.updateSeller(seller.id, { profileImage: profileImage.trim() });
        console.log(`[renewals] Auto-updated seller photo for ${seller.phone} (seller ID: ${seller.id})`);
      }

      const application = await storage.createRenewalApplication({
        sellerId: seller.id,
        phone: seller.phone,
        duration: String(Number(duration)),
        paymentMethod,
        senderNumber: senderNumber.trim(),
        profileImage: profileImage && typeof profileImage === "string" ? profileImage.trim() : undefined,
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

  const handleApproveRenewal = async (req: Request, res: Response) => {
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

      const updates: any = {
        expiryDate: newExpiryDate,
        renewalStartDate: oldExpiryDate,
        status: "active",
      };

      // If renewal application updated the photo, purge old photo from Cloudinary
      if (
        (application as any).profileImage &&
        seller.profileImage &&
        (application as any).profileImage !== seller.profileImage
      ) {
        console.log(`[Storage] Deleting old seller photo on renewal update: ${seller.profileImage}`);
        await deleteCloudinaryFile(seller.profileImage);
        updates.profileImage = (application as any).profileImage;
      }

      const updatedSeller = await storage.updateSeller(seller.id, updates);
      const updated = await storage.updateRenewalApplicationStatus(id, "approved");

      const wasArchived = seller.status === "deleted";
      console.log(`[renewals] Approved renewal for ${seller.phone}: ${oldExpiryDate} → ${newExpiryDate}${wasArchived ? " (restored from archived)" : ""}`);

      if (seller.email) {
        await sendRenewalApprovalEmail(
          seller.email,
          seller.name,
          seller.sellerCode,
          newExpiryDate
        );
      }

      if (updatedSeller) {
        await scheduleSellerEmails(updatedSeller);
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to approve renewal application" });
    }
  };

  app.post("/api/renewals/:id/approve", requireAuth, handleApproveRenewal);
  app.post("/api/admin/renewals/:id/approve", requireAuth, handleApproveRenewal);

  const handleRejectRenewal = async (req: Request, res: Response) => {
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
  };

  app.post("/api/renewals/:id/reject", requireAuth, handleRejectRenewal);
  app.post("/api/admin/renewals/:id/reject", requireAuth, handleRejectRenewal);

  app.delete("/api/renewals/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) return res.status(400).json({ message: "Invalid application ID" });
      const application = await storage.getRenewalApplicationById(id);
      if (!application) return res.status(404).json({ message: "Renewal application not found" });
      await storage.softDeleteRenewalApplication(id);
      console.log(`[renewals] Soft-deleted renewal application ID: ${id}`);
      res.json({ message: "Renewal application deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete renewal application" });
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

  async function syncMissingApprovedSellers(): Promise<number> {
    try {
      const applications = await storage.getAllSellerApplications();
      const approvedApps = applications.filter((app) => app.status === "approved");
      let syncedCount = 0;
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      for (const app of approvedApps) {
        const existing = await storage.getSellerByPhone(app.phone);
        const appDate = new Date(app.createdAt || Date.now());
        const isRecent = (today.getTime() - appDate.getTime()) < 30 * 24 * 60 * 60 * 1000;
        const needsSync = !existing || (existing.status !== "active" && (isRecent || app.phone === "01622122818"));

        if (needsSync) {
          console.log(`[SyncMigration] Syncing approved application: ID ${app.id}, name: ${app.name}, phone: ${app.phone}`);
          const startDate = todayStr;
          const duration = app.duration || "1";
          const sellerCode = await generateSellerCode(startDate, duration);
          const expiryDate = calculateExpiryDate(startDate, duration);

          if (existing) {
            const { seller } = await storage.approveApplicationWithExistingSeller(app.id, existing.id, {
              name: app.name,
              sellerCode,
              phone: app.phone,
              facebookLink: app.facebookLink || app.personalFacebookLink || existing.facebookLink,
              duration,
              startDate,
              expiryDate,
              email: app.email || existing.email || undefined,
              status: "active",
              profileImage: app.profileImage || existing.profileImage || undefined,
              hideProfilePhoto: app.hideProfilePhoto ?? existing.hideProfilePhoto ?? false,
              nidDocument: app.nidFileUrl || (existing as any).nidDocument || undefined,
            });

            await scheduleSellerEmails(seller).catch((err) =>
              console.error(`[SyncMigration] Email schedule error for ${seller.name}:`, err)
            );
            syncedCount++;
            console.log(`[SyncMigration] Restored and activated seller for approved application #${app.id}: Code ${sellerCode}`);
          } else {
            const { seller } = await storage.approveApplicationWithSeller(app.id, {
              name: app.name,
              phone: app.phone,
              facebookLink: app.facebookLink || app.personalFacebookLink || "",
              sellerCode,
              duration,
              startDate,
              expiryDate,
              email: app.email || undefined,
              profileImage: app.profileImage || undefined,
              hideProfilePhoto: app.hideProfilePhoto ?? false,
              nidDocument: app.nidFileUrl || undefined,
            });

            await scheduleSellerEmails(seller).catch((err) =>
              console.error(`[SyncMigration] Email schedule error for ${seller.name}:`, err)
            );
            syncedCount++;
            console.log(`[SyncMigration] Created active seller for approved application #${app.id}: Code ${sellerCode}`);
          }
        }
      }
      return syncedCount;
    } catch (error) {
      console.error("[SyncMigration] Error in syncMissingApprovedSellers:", error);
      return 0;
    }
  }

  // Auto-sync on startup
  syncMissingApprovedSellers().catch((e) => console.error("[SyncMigration] Startup sync error:", e));

  const handleGetApplications = async (_req: Request, res: Response) => {
    try {
      await syncMissingApprovedSellers();
      const applications = await storage.getAllSellerApplications();
      res.json(applications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  };

  app.get("/api/applications", requireAuth, handleGetApplications);
  app.get("/api/admin/applications", requireAuth, handleGetApplications);

  const handleApproveApplication = async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid application ID" });
      }
      const application = await storage.getSellerApplicationById(id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      const existingSeller = await storage.getSellerByPhone(application.phone);

      // If application already marked non-pending AND seller already exists and is active, prevent duplicate
      // But if seller does not exist OR is inactive/deleted, allow approval to create/activate the seller!
      if (application.status !== "pending" && existingSeller && existingSeller.status === "active") {
        return res.status(400).json({ message: `Application already ${application.status}` });
      }

      let activeSeller: Seller;
      let sellerCode: string;
      const today = new Date();
      const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const duration = application.duration || "1";
      const expiryDate = calculateExpiryDate(startDate, duration);

      if (existingSeller) {
        // Generate valid unique sellerCode
        sellerCode = await generateSellerCode(startDate, duration);

        const updates: any = {
          name: application.name,
          status: "active",
          sellerCode,
          duration,
          startDate,
          expiryDate,
          hideProfilePhoto: application.hideProfilePhoto ?? existingSeller.hideProfilePhoto ?? false,
          facebookLink: application.facebookLink || application.personalFacebookLink || existingSeller.facebookLink,
        };

        if (application.email) {
          updates.email = application.email;
        }

        if (application.nidFileUrl) {
          updates.nidDocument = application.nidFileUrl;
        }

        if (application.profileImage) {
          if (existingSeller.profileImage && existingSeller.profileImage !== application.profileImage) {
            console.log(`[Storage] Purging old seller photo on new application approval: ${existingSeller.profileImage}`);
            await deleteCloudinaryFile(existingSeller.profileImage).catch(() => {});
          }
          updates.profileImage = application.profileImage;
        }

        const result = await storage.approveApplicationWithExistingSeller(id, existingSeller.id, updates);
        activeSeller = result.seller;
        await scheduleSellerEmails(activeSeller).catch(() => {});
      } else {
        sellerCode = await generateSellerCode(startDate, duration);

        const result = await storage.approveApplicationWithSeller(id, {
          name: application.name,
          phone: application.phone,
          facebookLink: application.facebookLink || application.personalFacebookLink || "",
          sellerCode,
          duration,
          startDate,
          expiryDate,
          email: application.email || undefined,
          profileImage: application.profileImage || undefined,
          hideProfilePhoto: application.hideProfilePhoto ?? false,
          nidDocument: application.nidFileUrl || undefined,
        });

        activeSeller = result.seller;
        await scheduleSellerEmails(activeSeller).catch(() => {});
      }

      let emailSent = false;
      if (application.email) {
        emailSent = await sendSellerCodeEmail(
          application.email,
          application.name,
          sellerCode,
          startDate,
          expiryDate
        ).catch(() => false);
      }

      res.json({
        ...activeSeller,
        seller: activeSeller,
        sellerCode: activeSeller.sellerCode,
        applicationId: id,
        applicationStatus: "approved",
        emailSent,
      });
    } catch (error) {
      console.error("[approve] Error approving application:", error);
      res.status(500).json({ message: "Failed to approve application", error: error instanceof Error ? error.message : String(error) });
    }
  };

  app.post("/api/applications/:id/approve", requireAuth, handleApproveApplication);
  app.post("/api/admin/applications/:id/approve", requireAuth, handleApproveApplication);

  const handleRejectApplication = async (req: Request, res: Response) => {
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

      // Check if the application contains an uploaded sellerPhoto / profileImage and nidImage / nidFileUrl
      const filesToPurge: string[] = [];
      if (application.profileImage) filesToPurge.push(application.profileImage);
      if ((application as any).sellerPhoto) filesToPurge.push((application as any).sellerPhoto);
      if (application.nidFileUrl) filesToPurge.push(application.nidFileUrl);
      if ((application as any).nidImage) filesToPurge.push((application as any).nidImage);

      // Call deleteCloudinaryFile for images to purge them
      for (const fileUrl of filesToPurge) {
        await deleteCloudinaryFile(fileUrl);
      }

      // Clear the file fields in DB so no dangling URLs remain
      await storage.clearApplicationFiles(id);

      // Update the database application record status to "rejected"
      const updated = await storage.updateSellerApplicationStatus(id, "rejected");
      res.json(updated);
    } catch (error) {
      console.error("[reject] Error rejecting application:", error);
      res.status(500).json({ message: "Failed to reject application" });
    }
  };

  app.post("/api/applications/:id/reject", requireAuth, handleRejectApplication);
  app.post("/api/admin/applications/:id/reject", requireAuth, handleRejectApplication);

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

  const handleDeleteApplication = async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid application ID" });
      }
      const application = await storage.getSellerApplicationById(id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Check if application contains profileImage or nidFileUrl and purge them from Cloudinary
      const filesToPurge: string[] = [];
      if (application.profileImage) filesToPurge.push(application.profileImage);
      if ((application as any).sellerPhoto) filesToPurge.push((application as any).sellerPhoto);
      if (application.nidFileUrl) filesToPurge.push(application.nidFileUrl);
      if ((application as any).nidImage) filesToPurge.push((application as any).nidImage);

      for (const fileUrl of filesToPurge) {
        await deleteCloudinaryFile(fileUrl);
      }

      await storage.clearApplicationFiles(id);
      const deleted = await storage.deleteSellerApplication(id);
      if (!deleted) {
        return res.status(404).json({ message: "Application not found" });
      }
      res.json({ message: "Application deleted successfully" });
    } catch (error) {
      console.error("[delete application] Error deleting application:", error);
      res.status(500).json({ message: "Failed to delete application" });
    }
  };

  app.delete("/api/applications/:id", requireAuth, handleDeleteApplication);
  app.delete("/api/admin/applications/:id", requireAuth, handleDeleteApplication);

  app.post("/api/applications", applicationSubmitLimiter, async (req, res) => {
    try {
      const parsed = insertSellerApplicationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid application data", errors: parsed.error.errors });
      }
      if (!parsed.data.nidFileUrl) {
        return res.status(400).json({ message: "জাতীয় পরিচয়পত্রের ছবি আপলোড করা বাধ্যতামূলক" });
      }
      if (!parsed.data.profileImage) {
        return res.status(400).json({ message: "নিজের ছবি আপলোড করা বাধ্যতামূলক" });
      }
      const application = await storage.createSellerApplication(parsed.data);
      res.status(201).json(application);
    } catch (error) {
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  app.post("/api/applications/upload-photo", photoUploadLimiter, uploadJpgMiddleware, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No photo uploaded" });
      }
      const isJpg = req.file.mimetype === "image/jpeg" || (req.file.originalname && /\.(jpe?g)$/i.test(req.file.originalname));
      if (!isJpg) {
        return res.status(400).json({ message: "শুধুমাত্র JPG বা JPEG ফরম্যাটের ছবি গ্রহণযোগ্য।" });
      }
      const { phone } = req.body;
      const timestamp = Math.floor(Date.now() / 1000);
      const publicId = `PROFILE_${phone || "seller"}_${timestamp}.jpg`;
      const secureUrl = await uploadProfilePhoto(
        req.file.buffer,
        "image/jpeg",
        publicId
      );
      res.json({ url: secureUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to upload photo" });
    }
  });

  const handleSellerPhotoUpload = async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No photo uploaded" });
      }
      const isJpg = req.file.mimetype === "image/jpeg" || (req.file.originalname && /\.(jpe?g)$/i.test(req.file.originalname));
      if (!isJpg) {
        return res.status(400).json({ message: "শুধুমাত্র JPG বা JPEG ফরম্যাটের ছবি গ্রহণযোগ্য।" });
      }
      const { phone } = req.body;
      const timestamp = Math.floor(Date.now() / 1000);
      const publicId = `PROFILE_${phone || "seller"}_${timestamp}.jpg`;
      const secureUrl = await uploadProfilePhoto(
        req.file.buffer,
        "image/jpeg",
        publicId
      );
      res.json({ url: secureUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to upload photo" });
    }
  };

  const handleAdminAvatarUpload = async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) return res.status(400).json({ message: "Invalid seller ID" });

      const seller = await storage.getSellerById(id);
      if (!seller) return res.status(404).json({ message: "Seller not found" });

      if (!req.file) {
        return res.status(400).json({ message: "No photo uploaded" });
      }
      const isJpg = req.file.mimetype === "image/jpeg" || (req.file.originalname && /\.(jpe?g)$/i.test(req.file.originalname));
      if (!isJpg) {
        return res.status(400).json({ message: "শুধুমাত্র JPG বা JPEG ফরম্যাটের ছবি গ্রহণযোগ্য।" });
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const publicId = `PROFILE_${seller.phone || seller.sellerCode || id}_${timestamp}.jpg`;
      const secureUrl = await uploadProfilePhoto(
        req.file.buffer,
        "image/jpeg",
        publicId
      );

      // Clean up old photo if different
      if (seller.profileImage && seller.profileImage !== secureUrl) {
        deleteCloudinaryFile(seller.profileImage).catch(() => {});
      }

      const updated = await storage.updateSeller(id, { profileImage: secureUrl });
      res.json({ message: "Profile photo updated successfully", url: secureUrl, seller: updated });
    } catch (error: any) {
      console.error("[avatar-upload] Error uploading avatar:", error);
      res.status(500).json({ message: error.message || "Failed to upload avatar" });
    }
  };

  app.post("/api/sellers/:id/avatar", requireAuth, uploadJpgMiddleware, handleAdminAvatarUpload);
  app.post("/api/admin/sellers/:id/avatar", requireAuth, uploadJpgMiddleware, handleAdminAvatarUpload);

  app.post("/api/sellers/upload-photo", requireAuth, uploadJpgMiddleware, handleSellerPhotoUpload);
  app.post("/api/admin/sellers/upload-photo", requireAuth, uploadJpgMiddleware, handleSellerPhotoUpload);

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
      const senderEmail = await storage.getSetting("SENDER_EMAIL");
      const replyEmail = await storage.getSetting("REPLY_EMAIL");
      const facebookPageUrl = await storage.getSetting("FACEBOOK_PAGE_URL");
      res.json({
        senderName: senderName || "",
        senderEmail: senderEmail || "",
        replyEmail: replyEmail || "",
        facebookPageUrl: facebookPageUrl || "",
        hasApiKey: !!process.env.RESEND_API_KEY,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch email settings" });
    }
  });

  app.post("/api/settings/email", requireAuth, async (req, res) => {
    try {
      const { senderName, senderEmail, replyEmail, facebookPageUrl } = req.body;
      await storage.setSetting("SENDER_NAME", (senderName || "").trim());
      await storage.setSetting("SENDER_EMAIL", (senderEmail || "").trim());
      await storage.setSetting("REPLY_EMAIL", (replyEmail || "").trim());
      const fbUrl = (facebookPageUrl || "").trim();
      if (fbUrl) {
        try { new URL(fbUrl); } catch {
          return res.status(400).json({ message: "Invalid Facebook Page URL format" });
        }
      }
      await storage.setSetting("FACEBOOK_PAGE_URL", fbUrl);
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

  app.get("/api/settings/discount", async (_req, res) => {
    try {
      const val = await storage.getSetting("GLOBAL_DISCOUNT");
      res.json({ discount: parseInt(val || "0", 10) });
    } catch {
      res.status(500).json({ message: "Failed to fetch discount settings" });
    }
  });

  app.post("/api/settings/discount", requireAuth, async (req, res) => {
    try {
      const { discount } = req.body;
      if (![0, 20, 30, 40, 50].includes(Number(discount))) {
        return res.status(400).json({ message: "Invalid discount value" });
      }
      await storage.setSetting("GLOBAL_DISCOUNT", String(discount));
      res.json({ message: "Discount settings saved" });
    } catch {
      res.status(500).json({ message: "Failed to save discount settings" });
    }
  });

  // Payment Settings (public GET, protected POST)
  app.get("/api/settings/payment", async (_req, res) => {
    try {
      const bkash = await storage.getSetting("BKASH_NUMBER");
      const nagad = await storage.getSetting("NAGAD_NUMBER");
      res.json({
        bkashNumber: bkash || "01827259372",
        nagadNumber: nagad || "01972002118",
      });
    } catch {
      res.status(500).json({ message: "Failed to fetch payment settings" });
    }
  });

  app.post("/api/settings/payment", requireAuth, async (req, res) => {
    try {
      const { bkashNumber, nagadNumber } = req.body;
      if (bkashNumber !== undefined) await storage.setSetting("BKASH_NUMBER", String(bkashNumber).trim());
      if (nagadNumber !== undefined) await storage.setSetting("NAGAD_NUMBER", String(nagadNumber).trim());
      res.json({ message: "Payment settings saved" });
    } catch {
      res.status(500).json({ message: "Failed to save payment settings" });
    }
  });

  // Email Logs (protected)
  app.get("/api/email-logs", requireAuth, async (_req, res) => {
    try {
      const logs = await storage.getEmailLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch email logs" });
    }
  });

  app.delete("/api/email-logs", requireAuth, async (_req, res) => {
    try {
      await storage.clearEmailLogs();
      res.json({ message: "Email logs cleared" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear email logs" });
    }
  });

  // Resend webhook (public — receives delivery status events)
  app.post("/api/webhooks/resend", async (req, res) => {
    try {
      const event = req.body as { type?: string; data?: { email_id?: string } };
      const eventType = event?.type;
      const resendEmailId = event?.data?.email_id;

      if (!eventType || !resendEmailId) {
        return res.status(400).json({ message: "Invalid webhook payload" });
      }

      const STATUS_MAP: Record<string, string> = {
        "email.delivered":        "delivered",
        "email.opened":           "opened",
        "email.clicked":          "clicked",
        "email.bounced":          "bounced",
        "email.complained":       "complaint",
        "email.delivery_delayed": "pending",
      };

      const newStatus = STATUS_MAP[eventType];
      if (newStatus) {
        await storage.updateEmailLogStatus(resendEmailId, newStatus);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Resend webhook error:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // 404 handler for any unmatched /api routes
  app.all("/api/{*path}", (_req, res) => {
    res.status(404).json({ message: "API endpoint not found" });
  });

  return httpServer;
}
