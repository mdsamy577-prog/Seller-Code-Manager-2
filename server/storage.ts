import { type User, type InsertUser, type Seller, type InsertSeller, type InsertSellerApplication, type SellerApplication, type InsertSellerRenewalApplication, type SellerRenewalApplication, type EmailScheduleEntry, type EmailLog, type SocialCommunityLink, type InsertSocialCommunityLink, users, sellers, appSettings, sellerApplications, emailReminderLog, sellerRenewalApplications, emailSchedule, emailLogs, socialCommunityLinks } from "@shared/schema";
import { eq, or, ilike, count, and, ne, desc, asc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
export { deleteCloudinaryFile, deleteCloudinaryFile as deleteFileFromCloudflare } from "./cloudinary";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllSellers(): Promise<Seller[]>;
  getDeletedSellers(): Promise<Seller[]>;
  getSellerById(id: number): Promise<Seller | undefined>;
  createSeller(seller: InsertSeller & { expiryDate: string }): Promise<Seller>;
  updateSeller(id: number, seller: Partial<InsertSeller & { expiryDate: string; status?: string; renewalStartDate?: string | null }>): Promise<Seller | undefined>;
  softDeleteSeller(id: number): Promise<boolean>;
  deleteSeller(id: number): Promise<boolean>;
  restoreSeller(id: number): Promise<Seller | undefined>;
  searchSellers(query: string): Promise<Seller[]>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  getSettings(keys: string[]): Promise<Record<string, string>>;
  createSellerApplication(application: InsertSellerApplication): Promise<SellerApplication>;
  getAllSellerApplications(): Promise<SellerApplication[]>;
  getSellerApplicationById(id: number): Promise<SellerApplication | undefined>;
  updateSellerApplicationStatus(id: number, status: string): Promise<SellerApplication | undefined>;
  updateSellerApplicationEmail(id: number, email: string): Promise<SellerApplication | undefined>;
  approveApplicationWithSeller(applicationId: number, sellerData: InsertSeller & { expiryDate: string; nidDocument?: string | null }): Promise<{ application: SellerApplication; seller: Seller }>;
  approveApplicationWithExistingSeller(applicationId: number, sellerId: number, sellerUpdates: Partial<InsertSeller & { expiryDate: string; status?: string; renewalStartDate?: string | null; nidDocument?: string | null }>): Promise<{ application: SellerApplication; seller: Seller }>;
  clearApplicationNidFileUrl(id: number): Promise<void>;
  clearApplicationFiles(id: number): Promise<void>;
  getSellerByPhone(phone: string): Promise<Seller | undefined>;
  getSellerByCode(code: string): Promise<Seller | undefined>;
  deleteSellerApplication(id: number): Promise<boolean>;
  updateUserPassword(id: string, hashedPassword: string): Promise<void>;
  getUserCount(): Promise<number>;
  getAllUsers(): Promise<User[]>;
  getSellersWithEmail(): Promise<Seller[]>;
  hasReminderBeenSent(sellerId: number, reminderType: string, date: string): Promise<boolean>;
  logReminderSent(sellerId: number, reminderType: string, date: string): Promise<void>;
  getAndIncrementSerial(): Promise<number>;
  createRenewalApplication(data: InsertSellerRenewalApplication): Promise<SellerRenewalApplication>;
  getAllRenewalApplications(): Promise<SellerRenewalApplication[]>;
  getRenewalApplicationById(id: number): Promise<SellerRenewalApplication | undefined>;
  updateRenewalApplicationStatus(id: number, status: string): Promise<SellerRenewalApplication | undefined>;
  softDeleteRenewalApplication(id: number): Promise<void>;
  createEmailScheduleEntries(entries: { sellerId: number; sendAt: string; reminderType: string; emailType: string }[]): Promise<void>;
  getPendingScheduledEmails(): Promise<EmailScheduleEntry[]>;
  markScheduledEmailStatus(id: number, status: string): Promise<void>;
  cancelPendingEmailsForSeller(sellerId: number): Promise<void>;
  hasPendingScheduleForSeller(sellerId: number): Promise<boolean>;
  getNextPendingEmailPerSeller(): Promise<{ sellerId: number; sendAt: string }[]>;
  createEmailLog(data: { resendEmailId?: string; recipientEmail: string; sellerName: string; sellerCode: string; subject: string; emailType: string }): Promise<EmailLog>;
  updateEmailLogStatus(resendEmailId: string, status: string): Promise<void>;
  getEmailLogs(): Promise<EmailLog[]>;
  clearEmailLogs(): Promise<void>;
  getAllSocialCommunityLinks(): Promise<SocialCommunityLink[]>;
  getActiveSocialCommunityLinks(): Promise<SocialCommunityLink[]>;
  getSocialCommunityLinkById(id: number): Promise<SocialCommunityLink | undefined>;
  createSocialCommunityLink(data: InsertSocialCommunityLink): Promise<SocialCommunityLink>;
  updateSocialCommunityLink(id: number, data: Partial<InsertSocialCommunityLink>): Promise<SocialCommunityLink | undefined>;
  deleteSocialCommunityLink(id: number): Promise<boolean>;
  reorderSocialCommunityLinks(orderedIds: number[]): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private sellers: Map<number, Seller> = new Map();
  private settings: Map<string, string> = new Map();
  private applications: Map<number, SellerApplication> = new Map();
  private renewals: Map<number, SellerRenewalApplication> = new Map();
  private reminderLogs: Set<string> = new Set();
  private emailSchedules: Map<number, EmailScheduleEntry> = new Map();
  private emailLogsList: EmailLog[] = [];
  private currentSellerId = 1;
  private currentAppId = 1;
  private currentRenewalId = 1;
  private currentScheduleId = 1;
  private currentEmailLogId = 1;
  private communityLinks: Map<number, SocialCommunityLink> = new Map();
  private currentCommunityLinkId = 1;

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const user: User = {
      id,
      username: insertUser.username,
      password: insertUser.password,
      recoveryPhrase: insertUser.recoveryPhrase,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.password = hashedPassword;
      this.users.set(id, user);
    }
  }

  async getUserCount(): Promise<number> {
    return this.users.size;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getAllSellers(): Promise<Seller[]> {
    return Array.from(this.sellers.values()).filter((s) => s.status === "active");
  }

  async getDeletedSellers(): Promise<Seller[]> {
    return Array.from(this.sellers.values()).filter((s) => s.status === "deleted");
  }

  async getSellerById(id: number): Promise<Seller | undefined> {
    return this.sellers.get(id);
  }

  async createSeller(seller: InsertSeller & { expiryDate: string }): Promise<Seller> {
    const id = this.currentSellerId++;
    const newSeller: Seller = {
      id,
      name: seller.name,
      phone: seller.phone,
      facebookLink: seller.facebookLink,
      sellerCode: seller.sellerCode,
      duration: seller.duration,
      startDate: seller.startDate,
      expiryDate: seller.expiryDate,
      email: seller.email ?? null,
      status: "active",
      renewalStartDate: null,
      profileImage: seller.profileImage ?? null,
      hideProfilePhoto: seller.hideProfilePhoto ?? false,
      nidDocument: (seller as any).nidDocument ?? null,
    };
    this.sellers.set(id, newSeller);
    return newSeller;
  }

  async updateSeller(
    id: number,
    seller: Partial<InsertSeller & { expiryDate: string; status?: string; renewalStartDate?: string | null }>
  ): Promise<Seller | undefined> {
    const existing = this.sellers.get(id);
    if (!existing) return undefined;
    const updated: Seller = {
      ...existing,
      ...seller,
      email: seller.email !== undefined ? seller.email : existing.email,
      renewalStartDate: seller.renewalStartDate !== undefined ? seller.renewalStartDate : existing.renewalStartDate,
      profileImage: seller.profileImage !== undefined ? (seller.profileImage || null) : existing.profileImage,
      hideProfilePhoto: seller.hideProfilePhoto !== undefined ? seller.hideProfilePhoto : existing.hideProfilePhoto,
    };
    this.sellers.set(id, updated);
    return updated;
  }

  async softDeleteSeller(id: number): Promise<boolean> {
    const seller = this.sellers.get(id);
    if (!seller) return false;
    seller.status = "deleted";
    this.sellers.set(id, seller);
    return true;
  }

  async deleteSeller(id: number): Promise<boolean> {
    return this.sellers.delete(id);
  }

  async restoreSeller(id: number): Promise<Seller | undefined> {
    const seller = this.sellers.get(id);
    if (!seller) return undefined;
    seller.status = "active";
    this.sellers.set(id, seller);
    return seller;
  }

  async searchSellers(query: string): Promise<Seller[]> {
    const q = query.toLowerCase();
    return Array.from(this.sellers.values()).filter(
      (s) =>
        s.status === "active" &&
        (s.name.toLowerCase().includes(q) ||
          s.phone.toLowerCase().includes(q) ||
          s.sellerCode.toLowerCase().includes(q))
    );
  }

  async getSetting(key: string): Promise<string | null> {
    return this.settings.get(key) ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.settings.set(key, value);
  }

  async getSettings(keys: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const key of keys) {
      const val = this.settings.get(key);
      if (val !== undefined) result[key] = val;
    }
    return result;
  }

  async createSellerApplication(application: InsertSellerApplication): Promise<SellerApplication> {
    const id = this.currentAppId++;
    const app: SellerApplication = {
      id,
      name: application.name,
      phone: application.phone,
      facebookLink: application.facebookLink,
      duration: application.duration || "1_month",
      sellerType: application.sellerType || "personal_facebook_id",
      paymentMethod: application.paymentMethod || "bkash",
      senderNumber: application.senderNumber || "",
      email: application.email ?? null,
      status: "pending",
      createdAt: new Date().toISOString(),
      nidFileUrl: application.nidFileUrl ?? null,
      personalFacebookLink: application.personalFacebookLink ?? null,
      profileImage: application.profileImage ?? null,
      hideProfilePhoto: application.hideProfilePhoto ?? false,
    };
    this.applications.set(id, app);
    return app;
  }

  async getAllSellerApplications(): Promise<SellerApplication[]> {
    return Array.from(this.applications.values());
  }

  async getSellerApplicationById(id: number): Promise<SellerApplication | undefined> {
    return this.applications.get(id);
  }

  async updateSellerApplicationStatus(id: number, status: string): Promise<SellerApplication | undefined> {
    const app = this.applications.get(id);
    if (!app) return undefined;
    app.status = status;
    this.applications.set(id, app);
    return app;
  }

  async updateSellerApplicationEmail(id: number, email: string): Promise<SellerApplication | undefined> {
    const app = this.applications.get(id);
    if (!app) return undefined;
    app.email = email;
    this.applications.set(id, app);
    return app;
  }

  async approveApplicationWithSeller(
    applicationId: number,
    sellerData: InsertSeller & { expiryDate: string; nidDocument?: string | null }
  ): Promise<{ application: SellerApplication; seller: Seller }> {
    const app = this.applications.get(applicationId);
    if (app) {
      app.status = "approved";
      this.applications.set(applicationId, app);
    }
    const id = this.currentSellerId++;
    const newSeller: Seller = {
      id,
      name: sellerData.name,
      phone: sellerData.phone,
      facebookLink: sellerData.facebookLink,
      sellerCode: sellerData.sellerCode,
      duration: sellerData.duration,
      startDate: sellerData.startDate,
      expiryDate: sellerData.expiryDate,
      email: sellerData.email ?? null,
      status: "active",
      renewalStartDate: null,
      profileImage: sellerData.profileImage ?? null,
      hideProfilePhoto: sellerData.hideProfilePhoto ?? false,
      nidDocument: sellerData.nidDocument ?? null,
    };
    this.sellers.set(id, newSeller);
    return { application: app!, seller: newSeller };
  }

  async approveApplicationWithExistingSeller(
    applicationId: number,
    sellerId: number,
    sellerUpdates: Partial<InsertSeller & { expiryDate: string; status?: string; renewalStartDate?: string | null; nidDocument?: string | null }>
  ): Promise<{ application: SellerApplication; seller: Seller }> {
    const app = this.applications.get(applicationId);
    if (app) {
      app.status = "approved";
      this.applications.set(applicationId, app);
    }
    const existing = this.sellers.get(sellerId);
    const updated: Seller = {
      ...existing!,
      ...sellerUpdates,
    };
    this.sellers.set(sellerId, updated);
    return { application: app!, seller: updated };
  }

  async clearApplicationNidFileUrl(id: number): Promise<void> {
    const app = this.applications.get(id);
    if (app) {
      app.nidFileUrl = null;
      this.applications.set(id, app);
    }
  }

  async clearApplicationFiles(id: number): Promise<void> {
    const app = this.applications.get(id);
    if (app) {
      app.nidFileUrl = null;
      app.profileImage = null;
      this.applications.set(id, app);
    }
  }

  async getSellerByPhone(phone: string): Promise<Seller | undefined> {
    return Array.from(this.sellers.values()).find((s) => s.phone === phone);
  }

  async getSellerByCode(code: string): Promise<Seller | undefined> {
    return Array.from(this.sellers.values()).find((s) => s.sellerCode === code);
  }

  async deleteSellerApplication(id: number): Promise<boolean> {
    return this.applications.delete(id);
  }

  async getSellersWithEmail(): Promise<Seller[]> {
    return Array.from(this.sellers.values()).filter((s) => !!s.email && s.status === "active");
  }

  async hasReminderBeenSent(sellerId: number, reminderType: string, date: string): Promise<boolean> {
    return this.reminderLogs.has(`${sellerId}:${reminderType}:${date}`);
  }

  async logReminderSent(sellerId: number, reminderType: string, date: string): Promise<void> {
    this.reminderLogs.add(`${sellerId}:${reminderType}:${date}`);
  }

  async getAndIncrementSerial(): Promise<number> {
    const current = parseInt(this.settings.get("LAST_SELLER_SERIAL") || "0", 10);
    const next = current + 1;
    this.settings.set("LAST_SELLER_SERIAL", String(next));
    return next;
  }

  async createRenewalApplication(data: InsertSellerRenewalApplication): Promise<SellerRenewalApplication> {
    const id = this.currentRenewalId++;
    const renewal: SellerRenewalApplication = {
      id,
      sellerId: data.sellerId,
      phone: data.phone,
      duration: data.duration,
      paymentMethod: data.paymentMethod,
      senderNumber: data.senderNumber,
      status: "pending",
      createdAt: new Date().toISOString(),
      isDeleted: false,
      profileImage: data.profileImage ?? null,
      hideProfilePhoto: Boolean(data.hideProfilePhoto),
    };
    this.renewals.set(id, renewal);
    return renewal;
  }

  async getAllRenewalApplications(): Promise<SellerRenewalApplication[]> {
    return Array.from(this.renewals.values()).filter((r) => !r.isDeleted);
  }

  async getRenewalApplicationById(id: number): Promise<SellerRenewalApplication | undefined> {
    return this.renewals.get(id);
  }

  async updateRenewalApplicationStatus(id: number, status: string): Promise<SellerRenewalApplication | undefined> {
    const item = this.renewals.get(id);
    if (!item) return undefined;
    item.status = status;
    this.renewals.set(id, item);
    return item;
  }

  async softDeleteRenewalApplication(id: number): Promise<void> {
    const item = this.renewals.get(id);
    if (item) {
      item.isDeleted = true;
      this.renewals.set(id, item);
    }
  }

  async createEmailScheduleEntries(
    entries: { sellerId: number; sendAt: string; reminderType: string; emailType: string }[]
  ): Promise<void> {
    for (const entry of entries) {
      const id = this.currentScheduleId++;
      this.emailSchedules.set(id, {
        id,
        sellerId: entry.sellerId,
        sendAt: entry.sendAt,
        reminderType: entry.reminderType,
        emailType: entry.emailType,
        status: "pending",
      });
    }
  }

  async getPendingScheduledEmails(): Promise<EmailScheduleEntry[]> {
    const now = new Date();
    return Array.from(this.emailSchedules.values()).filter(
      (e) => e.status === "pending" && new Date(e.sendAt) <= now
    );
  }

  async markScheduledEmailStatus(id: number, status: string): Promise<void> {
    const entry = this.emailSchedules.get(id);
    if (entry) {
      entry.status = status;
      this.emailSchedules.set(id, entry);
    }
  }

  async cancelPendingEmailsForSeller(sellerId: number): Promise<void> {
    for (const entry of this.emailSchedules.values()) {
      if (entry.sellerId === sellerId && entry.status === "pending") {
        entry.status = "cancelled";
      }
    }
  }

  async hasPendingScheduleForSeller(sellerId: number): Promise<boolean> {
    return Array.from(this.emailSchedules.values()).some(
      (e) => e.sellerId === sellerId && e.status === "pending"
    );
  }

  async getNextPendingEmailPerSeller(): Promise<{ sellerId: number; sendAt: string }[]> {
    const now = new Date();
    const map = new Map<number, string>();
    for (const e of this.emailSchedules.values()) {
      if (e.status === "pending" && new Date(e.sendAt) > now) {
        const existing = map.get(e.sellerId);
        if (!existing || new Date(e.sendAt) < new Date(existing)) {
          map.set(e.sellerId, e.sendAt);
        }
      }
    }
    return Array.from(map.entries()).map(([sellerId, sendAt]) => ({ sellerId, sendAt }));
  }

  async createEmailLog(data: {
    resendEmailId?: string;
    recipientEmail: string;
    sellerName: string;
    sellerCode: string;
    subject: string;
    emailType: string;
  }): Promise<EmailLog> {
    const now = new Date().toISOString();
    const log: EmailLog = {
      id: this.currentEmailLogId++,
      resendEmailId: data.resendEmailId ?? null,
      recipientEmail: data.recipientEmail,
      sellerName: data.sellerName,
      sellerCode: data.sellerCode,
      subject: data.subject,
      emailType: data.emailType,
      status: "sent",
      sentAt: now,
      updatedAt: now,
    };
    this.emailLogsList.unshift(log);
    return log;
  }

  async updateEmailLogStatus(resendEmailId: string, status: string): Promise<void> {
    const log = this.emailLogsList.find((l) => l.resendEmailId === resendEmailId);
    if (log) {
      log.status = status;
      log.updatedAt = new Date().toISOString();
    }
  }

  async getEmailLogs(): Promise<EmailLog[]> {
    return this.emailLogsList.slice(0, 500);
  }

  async clearEmailLogs(): Promise<void> {
    this.emailLogsList = [];
  }

  async getAllSocialCommunityLinks(): Promise<SocialCommunityLink[]> {
    return Array.from(this.communityLinks.values()).sort((a, b) => (a.displayOrder - b.displayOrder) || (a.id - b.id));
  }

  async getActiveSocialCommunityLinks(): Promise<SocialCommunityLink[]> {
    return Array.from(this.communityLinks.values())
      .filter((l) => l.isActive)
      .sort((a, b) => (a.displayOrder - b.displayOrder) || (a.id - b.id));
  }

  async getSocialCommunityLinkById(id: number): Promise<SocialCommunityLink | undefined> {
    return this.communityLinks.get(id);
  }

  async createSocialCommunityLink(data: InsertSocialCommunityLink): Promise<SocialCommunityLink> {
    const id = this.currentCommunityLinkId++;
    const now = new Date().toISOString();
    const link: SocialCommunityLink = {
      id,
      platform: data.platform,
      groupName: data.groupName,
      description: data.description ?? null,
      invitationUrl: data.invitationUrl,
      isActive: data.isActive ?? true,
      displayOrder: data.displayOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.communityLinks.set(id, link);
    return link;
  }

  async updateSocialCommunityLink(id: number, data: Partial<InsertSocialCommunityLink>): Promise<SocialCommunityLink | undefined> {
    const existing = this.communityLinks.get(id);
    if (!existing) return undefined;
    const updated: SocialCommunityLink = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.communityLinks.set(id, updated);
    return updated;
  }

  async deleteSocialCommunityLink(id: number): Promise<boolean> {
    return this.communityLinks.delete(id);
  }

  async reorderSocialCommunityLinks(orderedIds: number[]): Promise<void> {
    orderedIds.forEach((id, index) => {
      const link = this.communityLinks.get(id);
      if (link) {
        link.displayOrder = index;
        link.updatedAt = new Date().toISOString();
        this.communityLinks.set(id, link);
      }
    });
  }
}

export function parseSupabaseUrl(raw: string): pg.PoolConfig {
  const withoutScheme = raw.replace(/^postgres(ql)?:\/\//, "");
  const lastAt = withoutScheme.lastIndexOf("@");
  const userInfo = withoutScheme.substring(0, lastAt);
  const hostInfo = withoutScheme.substring(lastAt + 1);
  const colonInUser = userInfo.indexOf(":");
  let user = userInfo.substring(0, colonInUser);
  let password = userInfo.substring(colonInUser + 1);
  try {
    if (user.includes("%")) user = decodeURIComponent(user);
    if (password.includes("%")) password = decodeURIComponent(password);
  } catch {}

  const slashInHost = hostInfo.indexOf("/");
  const hostPort = slashInHost === -1 ? hostInfo : hostInfo.substring(0, slashInHost);
  const database = slashInHost === -1 ? "postgres" : hostInfo.substring(slashInHost + 1);
  const colonInHost = hostPort.lastIndexOf(":");
  let host = colonInHost === -1 ? hostPort : hostPort.substring(0, colonInHost);
  let port = colonInHost === -1 ? 6543 : parseInt(hostPort.substring(colonInHost + 1), 10);

  // If host is misconfigured to aws-0 for this Supabase project, correct to aws-1 where the tenant is actually provisioned
  if (user.includes("fcjvzcinptnsukvakyhn") && host.includes("aws-0-ap-southeast-1.pooler.supabase.com")) {
    console.warn("[DB] Correcting Supabase pooler host from aws-0 to aws-1 for project fcjvzcinptnsukvakyhn");
    host = "aws-1-ap-southeast-1.pooler.supabase.com";
  }

  // Redirect direct hostname (db.fcjvzcinptnsukvakyhn.supabase.co) to transaction pooler for IPv4/serverless compatibility
  if (host.includes("db.fcjvzcinptnsukvakyhn.supabase.co")) {
    console.warn("[DB] Routing direct host to transaction pooler aws-1-ap-southeast-1.pooler.supabase.com:6543");
    host = "aws-1-ap-southeast-1.pooler.supabase.com";
    port = 6543;
  }

  return { user, password, host, port, database };
}

export class DatabaseStorage implements IStorage {
  private db: any;
  private pool: pg.Pool;

  constructor(pool: pg.Pool, dbInstance: any) {
    this.pool = pool;
    this.db = dbInstance;
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    await this.db.update(users).set({ password: hashedPassword }).where(eq(users.id, id));
  }

  async getUserCount(): Promise<number> {
    const result = await this.db.select({ value: count() }).from(users);
    return result[0].value;
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users);
  }

  async getAllSellers(): Promise<Seller[]> {
    return await this.db.select().from(sellers).where(eq(sellers.status, "active"));
  }

  async getDeletedSellers(): Promise<Seller[]> {
    return await this.db.select().from(sellers).where(eq(sellers.status, "deleted"));
  }

  async getSellerById(id: number): Promise<Seller | undefined> {
    const result = await this.db.select().from(sellers).where(eq(sellers.id, id));
    return result[0];
  }

  async createSeller(seller: InsertSeller & { expiryDate: string }): Promise<Seller> {
    const result = await this.db.insert(sellers).values(seller).returning();
    return result[0];
  }

  async updateSeller(id: number, seller: Partial<InsertSeller & { expiryDate: string }>): Promise<Seller | undefined> {
    const result = await this.db.update(sellers).set(seller).where(eq(sellers.id, id)).returning();
    return result[0];
  }

  async softDeleteSeller(id: number): Promise<boolean> {
    const result = await this.db.update(sellers).set({ status: "deleted" }).where(eq(sellers.id, id)).returning();
    return result.length > 0;
  }

  async deleteSeller(id: number): Promise<boolean> {
    const result = await this.db.delete(sellers).where(eq(sellers.id, id)).returning();
    return result.length > 0;
  }

  async restoreSeller(id: number): Promise<Seller | undefined> {
    const result = await this.db.update(sellers).set({ status: "active" }).where(eq(sellers.id, id)).returning();
    return result[0];
  }

  async searchSellers(query: string): Promise<Seller[]> {
    const searchTerm = `%${query}%`;
    return await this.db.select().from(sellers).where(
      and(
        eq(sellers.status, "active"),
        or(
          ilike(sellers.name, searchTerm),
          ilike(sellers.phone, searchTerm),
          ilike(sellers.sellerCode, searchTerm)
        )
      )
    );
  }

  async getSetting(key: string): Promise<string | null> {
    const result = await this.db.select().from(appSettings).where(eq(appSettings.key, key));
    return result[0]?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db.insert(appSettings).values({ key, value }).onConflictDoUpdate({
      target: appSettings.key,
      set: { value },
    });
  }

  async getSettings(keys: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const key of keys) {
      const val = await this.getSetting(key);
      if (val !== null) result[key] = val;
    }
    return result;
  }

  async createSellerApplication(application: InsertSellerApplication): Promise<SellerApplication> {
    const result = await this.db.insert(sellerApplications).values(application).returning();
    return result[0];
  }

  async getAllSellerApplications(): Promise<SellerApplication[]> {
    return await this.db.select().from(sellerApplications);
  }

  async getSellerApplicationById(id: number): Promise<SellerApplication | undefined> {
    const result = await this.db.select().from(sellerApplications).where(eq(sellerApplications.id, id));
    return result[0];
  }

  async updateSellerApplicationStatus(id: number, status: string): Promise<SellerApplication | undefined> {
    const result = await this.db.update(sellerApplications).set({ status }).where(eq(sellerApplications.id, id)).returning();
    return result[0];
  }

  async updateSellerApplicationEmail(id: number, email: string): Promise<SellerApplication | undefined> {
    const result = await this.db.update(sellerApplications).set({ email }).where(eq(sellerApplications.id, id)).returning();
    return result[0];
  }

  async approveApplicationWithSeller(
    applicationId: number,
    sellerData: InsertSeller & { expiryDate: string; nidDocument?: string | null }
  ): Promise<{ application: SellerApplication; seller: Seller }> {
    return await this.db.transaction(async (tx: any) => {
      const [createdSeller] = await tx
        .insert(sellers)
        .values({
          name: sellerData.name,
          phone: sellerData.phone,
          facebookLink: sellerData.facebookLink,
          sellerCode: sellerData.sellerCode,
          duration: sellerData.duration,
          startDate: sellerData.startDate,
          expiryDate: sellerData.expiryDate,
          email: sellerData.email || null,
          status: "active",
          profileImage: sellerData.profileImage || null,
          hideProfilePhoto: sellerData.hideProfilePhoto ?? false,
          nidDocument: sellerData.nidDocument || null,
        })
        .returning();

      const [updatedApp] = await tx
        .update(sellerApplications)
        .set({ status: "approved" })
        .where(eq(sellerApplications.id, applicationId))
        .returning();

      return { application: updatedApp, seller: createdSeller };
    });
  }

  async approveApplicationWithExistingSeller(
    applicationId: number,
    sellerId: number,
    sellerUpdates: Partial<InsertSeller & { expiryDate: string; status?: string; renewalStartDate?: string | null; nidDocument?: string | null }>
  ): Promise<{ application: SellerApplication; seller: Seller }> {
    return await this.db.transaction(async (tx: any) => {
      const [updatedSeller] = await tx
        .update(sellers)
        .set(sellerUpdates)
        .where(eq(sellers.id, sellerId))
        .returning();

      const [updatedApp] = await tx
        .update(sellerApplications)
        .set({ status: "approved" })
        .where(eq(sellerApplications.id, applicationId))
        .returning();

      return { application: updatedApp, seller: updatedSeller };
    });
  }

  async clearApplicationNidFileUrl(id: number): Promise<void> {
    await this.db.update(sellerApplications).set({ nidFileUrl: null }).where(eq(sellerApplications.id, id));
  }

  async clearApplicationFiles(id: number): Promise<void> {
    await this.db.update(sellerApplications).set({ nidFileUrl: null, profileImage: null }).where(eq(sellerApplications.id, id));
  }

  async deleteSellerApplication(id: number): Promise<boolean> {
    const result = await this.db.delete(sellerApplications).where(eq(sellerApplications.id, id)).returning();
    return result.length > 0;
  }

  async getSellerByPhone(phone: string): Promise<Seller | undefined> {
    const result = await this.db.select().from(sellers).where(eq(sellers.phone, phone));
    return result[0];
  }

  async getSellerByCode(code: string): Promise<Seller | undefined> {
    const result = await this.db.select().from(sellers).where(eq(sellers.sellerCode, code));
    return result[0];
  }

  async getSellersWithEmail(): Promise<Seller[]> {
    const activeSellers = await this.db.select().from(sellers).where(eq(sellers.status, "active"));
    return activeSellers.filter((s: Seller) => !!s.email);
  }

  async hasReminderBeenSent(sellerId: number, reminderType: string, date: string): Promise<boolean> {
    const result = await this.db.select().from(emailReminderLog).where(
      and(
        eq(emailReminderLog.sellerId, sellerId),
        eq(emailReminderLog.reminderType, reminderType),
        eq(emailReminderLog.sentDate, date)
      )
    );
    return result.length > 0;
  }

  async logReminderSent(sellerId: number, reminderType: string, date: string): Promise<void> {
    await this.db.insert(emailReminderLog).values({ sellerId, reminderType, sentDate: date });
  }

  async getAndIncrementSerial(): Promise<number> {
    const result = await this.db.execute(sql`
      INSERT INTO app_settings (key, value)
      VALUES ('LAST_SELLER_SERIAL', '1')
      ON CONFLICT (key)
      DO UPDATE SET value = (CAST(app_settings.value AS INTEGER) + 1)::text
      RETURNING value::integer AS serial
    `);
    return (result.rows[0] as any).serial;
  }

  async createRenewalApplication(data: InsertSellerRenewalApplication): Promise<SellerRenewalApplication> {
    const result = await this.db.insert(sellerRenewalApplications).values(data).returning();
    return result[0];
  }

  async getAllRenewalApplications(): Promise<SellerRenewalApplication[]> {
    return await this.db.select().from(sellerRenewalApplications).where(eq(sellerRenewalApplications.isDeleted, false));
  }

  async softDeleteRenewalApplication(id: number): Promise<void> {
    await this.db.update(sellerRenewalApplications).set({ isDeleted: true }).where(eq(sellerRenewalApplications.id, id));
  }

  async getRenewalApplicationById(id: number): Promise<SellerRenewalApplication | undefined> {
    const result = await this.db.select().from(sellerRenewalApplications).where(eq(sellerRenewalApplications.id, id));
    return result[0];
  }

  async updateRenewalApplicationStatus(id: number, status: string): Promise<SellerRenewalApplication | undefined> {
    const result = await this.db.update(sellerRenewalApplications).set({ status }).where(eq(sellerRenewalApplications.id, id)).returning();
    return result[0];
  }

  async createEmailScheduleEntries(entries: { sellerId: number; sendAt: string; reminderType: string; emailType: string }[]): Promise<void> {
    if (entries.length === 0) return;
    await this.db.insert(emailSchedule).values(entries);
  }

  async getPendingScheduledEmails(): Promise<EmailScheduleEntry[]> {
    const result = await this.db.execute(sql`
      SELECT * FROM email_schedule
      WHERE status = 'pending' AND send_at::timestamptz <= NOW()
    `);
    return (result.rows as any[]).map((r: any) => ({
      id: r.id as number,
      sellerId: r.seller_id as number,
      sendAt: r.send_at as string,
      reminderType: r.reminder_type as string,
      emailType: r.email_type as string,
      status: r.status as string,
    }));
  }

  async markScheduledEmailStatus(id: number, status: string): Promise<void> {
    await this.db.update(emailSchedule).set({ status }).where(eq(emailSchedule.id, id));
  }

  async cancelPendingEmailsForSeller(sellerId: number): Promise<void> {
    await this.db.update(emailSchedule)
      .set({ status: "cancelled" })
      .where(and(eq(emailSchedule.sellerId, sellerId), eq(emailSchedule.status, "pending")));
  }

  async hasPendingScheduleForSeller(sellerId: number): Promise<boolean> {
    const result = await this.db.select({ id: emailSchedule.id }).from(emailSchedule)
      .where(and(eq(emailSchedule.sellerId, sellerId), eq(emailSchedule.status, "pending")))
      .limit(1);
    return result.length > 0;
  }

  async getNextPendingEmailPerSeller(): Promise<{ sellerId: number; sendAt: string }[]> {
    const result = await this.db.execute(sql`
      SELECT DISTINCT ON (seller_id) seller_id, send_at
      FROM email_schedule
      WHERE status = 'pending' AND send_at::timestamptz > NOW()
      ORDER BY seller_id, send_at::timestamptz ASC
    `);
    return (result.rows as any[]).map((r: any) => ({
      sellerId: r.seller_id as number,
      sendAt: r.send_at as string,
    }));
  }

  async createEmailLog(data: { resendEmailId?: string; recipientEmail: string; sellerName: string; sellerCode: string; subject: string; emailType: string }): Promise<EmailLog> {
    const now = new Date().toISOString();
    const result = await this.db.insert(emailLogs).values({
      resendEmailId: data.resendEmailId ?? null,
      recipientEmail: data.recipientEmail,
      sellerName: data.sellerName,
      sellerCode: data.sellerCode,
      subject: data.subject,
      emailType: data.emailType,
      status: "sent",
      sentAt: now,
      updatedAt: now,
    }).returning();
    return result[0];
  }

  async updateEmailLogStatus(resendEmailId: string, status: string): Promise<void> {
    await this.db.update(emailLogs)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(emailLogs.resendEmailId, resendEmailId));
  }

  async getEmailLogs(): Promise<EmailLog[]> {
    return this.db.select().from(emailLogs).orderBy(desc(emailLogs.sentAt)).limit(500);
  }

  async clearEmailLogs(): Promise<void> {
    await this.db.delete(emailLogs);
  }

  async getAllSocialCommunityLinks(): Promise<SocialCommunityLink[]> {
    return await this.db
      .select()
      .from(socialCommunityLinks)
      .orderBy(asc(socialCommunityLinks.displayOrder), asc(socialCommunityLinks.id));
  }

  async getActiveSocialCommunityLinks(): Promise<SocialCommunityLink[]> {
    return await this.db
      .select()
      .from(socialCommunityLinks)
      .where(eq(socialCommunityLinks.isActive, true))
      .orderBy(asc(socialCommunityLinks.displayOrder), asc(socialCommunityLinks.id));
  }

  async getSocialCommunityLinkById(id: number): Promise<SocialCommunityLink | undefined> {
    const res = await this.db
      .select()
      .from(socialCommunityLinks)
      .where(eq(socialCommunityLinks.id, id));
    return res[0];
  }

  async createSocialCommunityLink(data: InsertSocialCommunityLink): Promise<SocialCommunityLink> {
    const now = new Date().toISOString();
    const res = await this.db
      .insert(socialCommunityLinks)
      .values({
        platform: data.platform,
        groupName: data.groupName,
        description: data.description ?? null,
        invitationUrl: data.invitationUrl,
        isActive: data.isActive ?? true,
        displayOrder: data.displayOrder ?? 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return res[0];
  }

  async updateSocialCommunityLink(id: number, data: Partial<InsertSocialCommunityLink>): Promise<SocialCommunityLink | undefined> {
    const now = new Date().toISOString();
    const res = await this.db
      .update(socialCommunityLinks)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(socialCommunityLinks.id, id))
      .returning();
    return res[0];
  }

  async deleteSocialCommunityLink(id: number): Promise<boolean> {
    const res = await this.db
      .delete(socialCommunityLinks)
      .where(eq(socialCommunityLinks.id, id))
      .returning();
    return res.length > 0;
  }

  async reorderSocialCommunityLinks(orderedIds: number[]): Promise<void> {
    const now = new Date().toISOString();
    for (let i = 0; i < orderedIds.length; i++) {
      await this.db
        .update(socialCommunityLinks)
        .set({ displayOrder: i, updatedAt: now })
        .where(eq(socialCommunityLinks.id, orderedIds[i]));
    }
  }
}

export class ResilientStorage implements IStorage {
  private dbStorage: DatabaseStorage | null = null;
  private memStorage: MemStorage;
  private isProduction: boolean;

  constructor(dbStorage: DatabaseStorage | null, memStorage: MemStorage) {
    this.dbStorage = dbStorage;
    this.memStorage = memStorage;
    this.isProduction =
      process.env.NODE_ENV === "production" ||
      process.env.SERVERLESS === "true" ||
      Boolean(process.env.VERCEL);
  }

  private async execute<T>(op: (s: IStorage) => Promise<T>): Promise<T> {
    if (!this.dbStorage) {
      if (this.isProduction) {
        const err: any = new Error("Database connection is not configured in production.");
        err.code = "ECONNREFUSED";
        throw err;
      }
      return op(this.memStorage);
    }

    try {
      return await op(this.dbStorage);
    } catch (err: any) {
      if (this.isProduction) {
        console.error(`[DB] Production database error (${err?.code || 'NO_CODE'}): ${err?.message || err}`);
        // In production, strictly throw the error: NEVER silently return empty/mock data!
        throw err;
      }
      console.warn(`[DB] Development database error (${err?.message || err}) — falling back to in-memory storage`);
      return op(this.memStorage);
    }
  }

  getUser(id: string) { return this.execute((s) => s.getUser(id)); }
  getUserByUsername(username: string) { return this.execute((s) => s.getUserByUsername(username)); }
  createUser(user: InsertUser) { return this.execute((s) => s.createUser(user)); }
  getAllSellers() { return this.execute((s) => s.getAllSellers()); }
  getDeletedSellers() { return this.execute((s) => s.getDeletedSellers()); }
  getSellerById(id: number) { return this.execute((s) => s.getSellerById(id)); }
  createSeller(seller: InsertSeller & { expiryDate: string }) { return this.execute((s) => s.createSeller(seller)); }
  updateSeller(id: number, seller: Partial<InsertSeller & { expiryDate: string; status?: string; renewalStartDate?: string | null }>) { return this.execute((s) => s.updateSeller(id, seller)); }
  softDeleteSeller(id: number) { return this.execute((s) => s.softDeleteSeller(id)); }
  deleteSeller(id: number) { return this.execute((s) => s.deleteSeller(id)); }
  restoreSeller(id: number) { return this.execute((s) => s.restoreSeller(id)); }
  searchSellers(query: string) { return this.execute((s) => s.searchSellers(query)); }
  getSetting(key: string) { return this.execute((s) => s.getSetting(key)); }
  setSetting(key: string, value: string) { return this.execute((s) => s.setSetting(key, value)); }
  getSettings(keys: string[]) { return this.execute((s) => s.getSettings(keys)); }
  createSellerApplication(application: InsertSellerApplication) { return this.execute((s) => s.createSellerApplication(application)); }
  getAllSellerApplications() { return this.execute((s) => s.getAllSellerApplications()); }
  getSellerApplicationById(id: number) { return this.execute((s) => s.getSellerApplicationById(id)); }
  updateSellerApplicationStatus(id: number, status: string) { return this.execute((s) => s.updateSellerApplicationStatus(id, status)); }
  updateSellerApplicationEmail(id: number, email: string) { return this.execute((s) => s.updateSellerApplicationEmail(id, email)); }
  approveApplicationWithSeller(applicationId: number, sellerData: InsertSeller & { expiryDate: string; nidDocument?: string | null }) { return this.execute((s) => s.approveApplicationWithSeller(applicationId, sellerData)); }
  approveApplicationWithExistingSeller(applicationId: number, sellerId: number, sellerUpdates: Partial<InsertSeller & { expiryDate: string; status?: string; renewalStartDate?: string | null; nidDocument?: string | null }>) { return this.execute((s) => s.approveApplicationWithExistingSeller(applicationId, sellerId, sellerUpdates)); }
  clearApplicationNidFileUrl(id: number) { return this.execute((s) => s.clearApplicationNidFileUrl(id)); }
  clearApplicationFiles(id: number) { return this.execute((s) => s.clearApplicationFiles(id)); }
  getSellerByPhone(phone: string) { return this.execute((s) => s.getSellerByPhone(phone)); }
  getSellerByCode(code: string) { return this.execute((s) => s.getSellerByCode(code)); }
  deleteSellerApplication(id: number) { return this.execute((s) => s.deleteSellerApplication(id)); }
  updateUserPassword(id: string, hashedPassword: string) { return this.execute((s) => s.updateUserPassword(id, hashedPassword)); }
  getUserCount() { return this.execute((s) => s.getUserCount()); }
  getAllUsers() { return this.execute((s) => s.getAllUsers()); }
  getSellersWithEmail() { return this.execute((s) => s.getSellersWithEmail()); }
  hasReminderBeenSent(sellerId: number, reminderType: string, date: string) { return this.execute((s) => s.hasReminderBeenSent(sellerId, reminderType, date)); }
  logReminderSent(sellerId: number, reminderType: string, date: string) { return this.execute((s) => s.logReminderSent(sellerId, reminderType, date)); }
  getAndIncrementSerial() { return this.execute((s) => s.getAndIncrementSerial()); }
  createRenewalApplication(data: InsertSellerRenewalApplication) { return this.execute((s) => s.createRenewalApplication(data)); }
  getAllRenewalApplications() { return this.execute((s) => s.getAllRenewalApplications()); }
  getRenewalApplicationById(id: number) { return this.execute((s) => s.getRenewalApplicationById(id)); }
  updateRenewalApplicationStatus(id: number, status: string) { return this.execute((s) => s.updateRenewalApplicationStatus(id, status)); }
  softDeleteRenewalApplication(id: number) { return this.execute((s) => s.softDeleteRenewalApplication(id)); }
  createEmailScheduleEntries(entries: { sellerId: number; sendAt: string; reminderType: string; emailType: string }[]) { return this.execute((s) => s.createEmailScheduleEntries(entries)); }
  getPendingScheduledEmails() { return this.execute((s) => s.getPendingScheduledEmails()); }
  markScheduledEmailStatus(id: number, status: string) { return this.execute((s) => s.markScheduledEmailStatus(id, status)); }
  cancelPendingEmailsForSeller(sellerId: number) { return this.execute((s) => s.cancelPendingEmailsForSeller(sellerId)); }
  hasPendingScheduleForSeller(sellerId: number) { return this.execute((s) => s.hasPendingScheduleForSeller(sellerId)); }
  getNextPendingEmailPerSeller() { return this.execute((s) => s.getNextPendingEmailPerSeller()); }
  createEmailLog(data: { resendEmailId?: string; recipientEmail: string; sellerName: string; sellerCode: string; subject: string; emailType: string }) { return this.execute((s) => s.createEmailLog(data)); }
  updateEmailLogStatus(resendEmailId: string, status: string) { return this.execute((s) => s.updateEmailLogStatus(resendEmailId, status)); }
  getEmailLogs() { return this.execute((s) => s.getEmailLogs()); }
  clearEmailLogs() { return this.execute((s) => s.clearEmailLogs()); }
  getAllSocialCommunityLinks() { return this.execute((s) => s.getAllSocialCommunityLinks()); }
  getActiveSocialCommunityLinks() { return this.execute((s) => s.getActiveSocialCommunityLinks()); }
  getSocialCommunityLinkById(id: number) { return this.execute((s) => s.getSocialCommunityLinkById(id)); }
  createSocialCommunityLink(data: InsertSocialCommunityLink) { return this.execute((s) => s.createSocialCommunityLink(data)); }
  updateSocialCommunityLink(id: number, data: Partial<InsertSocialCommunityLink>) { return this.execute((s) => s.updateSocialCommunityLink(id, data)); }
  deleteSocialCommunityLink(id: number) { return this.execute((s) => s.deleteSocialCommunityLink(id)); }
  reorderSocialCommunityLinks(orderedIds: number[]) { return this.execute((s) => s.reorderSocialCommunityLinks(orderedIds)); }
}

function initStorage(): IStorage {
  const memStorage = new MemStorage();
  const rawUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || "";
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.SERVERLESS === "true" ||
    Boolean(process.env.VERCEL);

  if (!rawUrl) {
    if (isProduction) {
      console.error("[CRITICAL] Neither SUPABASE_DATABASE_URL nor DATABASE_URL is set in production!");
      return new ResilientStorage(null, memStorage);
    }
    console.warn("[AI Studio] No database URL configured — using in-memory mock storage for local dev");
    return memStorage;
  }

  try {
    const poolConfig: pg.PoolConfig = {
      ...parseSupabaseUrl(rawUrl),
      max: isProduction ? 3 : 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
    };

    const pool = new pg.Pool(poolConfig);
    pool.query(`
      CREATE TABLE IF NOT EXISTS social_community_links (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        platform text NOT NULL,
        group_name text NOT NULL,
        description text,
        invitation_url text NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        display_order integer NOT NULL DEFAULT 0,
        created_at text NOT NULL DEFAULT now(),
        updated_at text NOT NULL DEFAULT now()
      );
      ALTER TABLE IF EXISTS sellers ADD COLUMN IF NOT EXISTS profile_image text;
      ALTER TABLE IF EXISTS sellers ADD COLUMN IF NOT EXISTS hide_profile_photo boolean DEFAULT false;
      ALTER TABLE IF EXISTS sellers ADD COLUMN IF NOT EXISTS nid_document text;
      ALTER TABLE IF EXISTS seller_applications ADD COLUMN IF NOT EXISTS profile_image text;
      ALTER TABLE IF EXISTS seller_applications ADD COLUMN IF NOT EXISTS hide_profile_photo boolean DEFAULT false;
      ALTER TABLE IF EXISTS seller_renewal_applications ADD COLUMN IF NOT EXISTS profile_image text;
      ALTER TABLE IF EXISTS seller_renewal_applications ADD COLUMN IF NOT EXISTS hide_profile_photo boolean DEFAULT false;
    `).catch((err: any) => {
      console.warn("[DB] Non-fatal migration check warning:", err?.message || err);
    });

    pool.on("error", (err) => {
      console.warn("[DB] Pool background error:", err?.message || err);
    });

    const RETRYABLE_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "57P01", "08006", "08001", "08004"]);
    const isRetryableError = (err: any): boolean => {
      return (
        RETRYABLE_CODES.has(err?.code) ||
        (typeof err?.message === "string" && (
          err.message.includes("terminating connection") ||
          err.message.includes("Connection terminated") ||
          err.message.includes("connection timeout") ||
          err.message.includes("ssl connection has been closed unexpectedly")
        ))
      );
    };

    const originalQuery = pool.query.bind(pool);
    (pool as any).query = async function (...args: any[]) {
      try {
        return await (originalQuery as Function)(...args);
      } catch (err: any) {
        if (isRetryableError(err)) {
          console.error(`[DB] Retryable connection error — retrying once: ${err.message}`);
          await new Promise((r) => setTimeout(r, 500));
          return await (originalQuery as Function)(...args);
        }
        throw err;
      }
    };

    const db = drizzle(pool);
    const dbStorage = new DatabaseStorage(pool, db);
    return new ResilientStorage(dbStorage, memStorage);
  } catch (err) {
    if (isProduction) {
      console.error("[CRITICAL] Database initialization failed in production:", err);
      return new ResilientStorage(null, memStorage);
    }
    console.warn("[AI Studio] Database initialization failed — falling back to mock storage:", err);
    return memStorage;
  }
}

export const storage: IStorage = initStorage();

