import { type User, type InsertUser, type Seller, type InsertSeller, type InsertSellerApplication, type SellerApplication, type InsertSellerRenewalApplication, type SellerRenewalApplication, type EmailScheduleEntry, users, sellers, appSettings, sellerApplications, emailReminderLog, sellerRenewalApplications, emailSchedule } from "@shared/schema";
import { eq, or, ilike, count, and, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected PostgreSQL pool error:", err.message);
});

const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllSellers(): Promise<Seller[]>;
  getDeletedSellers(): Promise<Seller[]>;
  getSellerById(id: number): Promise<Seller | undefined>;
  createSeller(seller: InsertSeller & { expiryDate: string }): Promise<Seller>;
  updateSeller(id: number, seller: Partial<InsertSeller & { expiryDate: string; status?: string }>): Promise<Seller | undefined>;
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
  clearApplicationNidFileUrl(id: number): Promise<void>;
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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id));
  }

  async getUserCount(): Promise<number> {
    const result = await db.select({ value: count() }).from(users);
    return result[0].value;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getAllSellers(): Promise<Seller[]> {
    return await db.select().from(sellers).where(eq(sellers.status, "active"));
  }

  async getDeletedSellers(): Promise<Seller[]> {
    return await db.select().from(sellers).where(eq(sellers.status, "deleted"));
  }

  async getSellerById(id: number): Promise<Seller | undefined> {
    const result = await db.select().from(sellers).where(eq(sellers.id, id));
    return result[0];
  }

  async createSeller(seller: InsertSeller & { expiryDate: string }): Promise<Seller> {
    const result = await db.insert(sellers).values(seller).returning();
    return result[0];
  }

  async updateSeller(id: number, seller: Partial<InsertSeller & { expiryDate: string }>): Promise<Seller | undefined> {
    const result = await db.update(sellers).set(seller).where(eq(sellers.id, id)).returning();
    return result[0];
  }

  async softDeleteSeller(id: number): Promise<boolean> {
    const result = await db.update(sellers).set({ status: "deleted" }).where(eq(sellers.id, id)).returning();
    return result.length > 0;
  }

  async deleteSeller(id: number): Promise<boolean> {
    const result = await db.delete(sellers).where(eq(sellers.id, id)).returning();
    return result.length > 0;
  }

  async restoreSeller(id: number): Promise<Seller | undefined> {
    const result = await db.update(sellers).set({ status: "active" }).where(eq(sellers.id, id)).returning();
    return result[0];
  }

  async searchSellers(query: string): Promise<Seller[]> {
    const searchTerm = `%${query}%`;
    return await db.select().from(sellers).where(
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
    const result = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return result[0]?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db.insert(appSettings).values({ key, value }).onConflictDoUpdate({
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
    const result = await db.insert(sellerApplications).values(application).returning();
    return result[0];
  }

  async getAllSellerApplications(): Promise<SellerApplication[]> {
    return await db.select().from(sellerApplications);
  }

  async getSellerApplicationById(id: number): Promise<SellerApplication | undefined> {
    const result = await db.select().from(sellerApplications).where(eq(sellerApplications.id, id));
    return result[0];
  }

  async updateSellerApplicationStatus(id: number, status: string): Promise<SellerApplication | undefined> {
    const result = await db.update(sellerApplications).set({ status }).where(eq(sellerApplications.id, id)).returning();
    return result[0];
  }

  async updateSellerApplicationEmail(id: number, email: string): Promise<SellerApplication | undefined> {
    const result = await db.update(sellerApplications).set({ email }).where(eq(sellerApplications.id, id)).returning();
    return result[0];
  }

  async clearApplicationNidFileUrl(id: number): Promise<void> {
    await db.update(sellerApplications).set({ nidFileUrl: null }).where(eq(sellerApplications.id, id));
  }

  async deleteSellerApplication(id: number): Promise<boolean> {
    const result = await db.delete(sellerApplications).where(eq(sellerApplications.id, id)).returning();
    return result.length > 0;
  }

  async getSellerByPhone(phone: string): Promise<Seller | undefined> {
    const result = await db.select().from(sellers).where(eq(sellers.phone, phone));
    return result[0];
  }

  async getSellerByCode(code: string): Promise<Seller | undefined> {
    const result = await db.select().from(sellers).where(eq(sellers.sellerCode, code));
    return result[0];
  }

  async getSellersWithEmail(): Promise<Seller[]> {
    const activeSellers = await db.select().from(sellers).where(eq(sellers.status, "active"));
    return activeSellers.filter(s => s.email);
  }

  async hasReminderBeenSent(sellerId: number, reminderType: string, date: string): Promise<boolean> {
    const result = await db.select().from(emailReminderLog).where(
      and(
        eq(emailReminderLog.sellerId, sellerId),
        eq(emailReminderLog.reminderType, reminderType),
        eq(emailReminderLog.sentDate, date)
      )
    );
    return result.length > 0;
  }

  async logReminderSent(sellerId: number, reminderType: string, date: string): Promise<void> {
    await db.insert(emailReminderLog).values({ sellerId, reminderType, sentDate: date });
  }

  async getAndIncrementSerial(): Promise<number> {
    const result = await db.execute(sql`
      INSERT INTO app_settings (key, value)
      VALUES ('LAST_SELLER_SERIAL', '1')
      ON CONFLICT (key)
      DO UPDATE SET value = (CAST(app_settings.value AS INTEGER) + 1)::text
      RETURNING value::integer AS serial
    `);
    return (result.rows[0] as any).serial;
  }

  async createRenewalApplication(data: InsertSellerRenewalApplication): Promise<SellerRenewalApplication> {
    const result = await db.insert(sellerRenewalApplications).values(data).returning();
    return result[0];
  }

  async getAllRenewalApplications(): Promise<SellerRenewalApplication[]> {
    return await db.select().from(sellerRenewalApplications).where(eq(sellerRenewalApplications.isDeleted, false));
  }

  async softDeleteRenewalApplication(id: number): Promise<void> {
    await db.update(sellerRenewalApplications).set({ isDeleted: true }).where(eq(sellerRenewalApplications.id, id));
  }

  async getRenewalApplicationById(id: number): Promise<SellerRenewalApplication | undefined> {
    const result = await db.select().from(sellerRenewalApplications).where(eq(sellerRenewalApplications.id, id));
    return result[0];
  }

  async updateRenewalApplicationStatus(id: number, status: string): Promise<SellerRenewalApplication | undefined> {
    const result = await db.update(sellerRenewalApplications).set({ status }).where(eq(sellerRenewalApplications.id, id)).returning();
    return result[0];
  }

  async createEmailScheduleEntries(entries: { sellerId: number; sendAt: string; reminderType: string; emailType: string }[]): Promise<void> {
    if (entries.length === 0) return;
    await db.insert(emailSchedule).values(entries);
  }

  async getPendingScheduledEmails(): Promise<EmailScheduleEntry[]> {
    const result = await db.execute(sql`
      SELECT * FROM email_schedule
      WHERE status = 'pending' AND send_at::timestamptz <= NOW()
    `);
    return (result.rows as any[]).map((r) => ({
      id: r.id as number,
      sellerId: r.seller_id as number,
      sendAt: r.send_at as string,
      reminderType: r.reminder_type as string,
      emailType: r.email_type as string,
      status: r.status as string,
    }));
  }

  async markScheduledEmailStatus(id: number, status: string): Promise<void> {
    await db.update(emailSchedule).set({ status }).where(eq(emailSchedule.id, id));
  }

  async cancelPendingEmailsForSeller(sellerId: number): Promise<void> {
    await db.update(emailSchedule)
      .set({ status: "cancelled" })
      .where(and(eq(emailSchedule.sellerId, sellerId), eq(emailSchedule.status, "pending")));
  }

  async hasPendingScheduleForSeller(sellerId: number): Promise<boolean> {
    const result = await db.select({ id: emailSchedule.id }).from(emailSchedule)
      .where(and(eq(emailSchedule.sellerId, sellerId), eq(emailSchedule.status, "pending")))
      .limit(1);
    return result.length > 0;
  }

  async getNextPendingEmailPerSeller(): Promise<{ sellerId: number; sendAt: string }[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT ON (seller_id) seller_id, send_at
      FROM email_schedule
      WHERE status = 'pending' AND send_at::timestamptz > NOW()
      ORDER BY seller_id, send_at::timestamptz ASC
    `);
    return (result.rows as any[]).map((r) => ({
      sellerId: r.seller_id as number,
      sendAt: r.send_at as string,
    }));
  }
}

export const storage = new DatabaseStorage();
