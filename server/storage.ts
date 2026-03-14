import { type User, type InsertUser, type Seller, type InsertSeller, type InsertSellerApplication, type SellerApplication, users, sellers, appSettings, sellerApplications, emailReminderLog } from "@shared/schema";
import { eq, or, ilike, count, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllSellers(): Promise<Seller[]>;
  getSellerById(id: number): Promise<Seller | undefined>;
  createSeller(seller: InsertSeller & { expiryDate: string }): Promise<Seller>;
  updateSeller(id: number, seller: Partial<InsertSeller & { expiryDate: string }>): Promise<Seller | undefined>;
  deleteSeller(id: number): Promise<boolean>;
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
  getSellerByCode(code: string): Promise<Seller | undefined>;
  deleteSellerApplication(id: number): Promise<boolean>;
  updateUserPassword(id: string, hashedPassword: string): Promise<void>;
  getUserCount(): Promise<number>;
  getAllUsers(): Promise<User[]>;
  getSellersWithEmail(): Promise<Seller[]>;
  hasReminderBeenSent(sellerId: number, reminderType: string, date: string): Promise<boolean>;
  logReminderSent(sellerId: number, reminderType: string, date: string): Promise<void>;
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
    return await db.select().from(sellers);
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

  async deleteSeller(id: number): Promise<boolean> {
    const result = await db.delete(sellers).where(eq(sellers.id, id)).returning();
    return result.length > 0;
  }

  async searchSellers(query: string): Promise<Seller[]> {
    const searchTerm = `%${query}%`;
    return await db.select().from(sellers).where(
      or(
        ilike(sellers.name, searchTerm),
        ilike(sellers.phone, searchTerm),
        ilike(sellers.sellerCode, searchTerm)
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

  async getSellerByCode(code: string): Promise<Seller | undefined> {
    const result = await db.select().from(sellers).where(eq(sellers.sellerCode, code));
    return result[0];
  }

  async getSellersWithEmail(): Promise<Seller[]> {
    const allSellers = await db.select().from(sellers);
    return allSellers.filter(s => s.email);
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
}

export const storage = new DatabaseStorage();
