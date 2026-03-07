import { type User, type InsertUser, type Seller, type InsertSeller, type InsertSellerApplication, type SellerApplication, sellers, appSettings, sellerApplications } from "@shared/schema";
import { randomUUID } from "crypto";
import { eq, or, ilike } from "drizzle-orm";
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
  getSellerByCode(code: string): Promise<Seller | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    return undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    return { ...insertUser, id };
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

  async getSellerByCode(code: string): Promise<Seller | undefined> {
    const result = await db.select().from(sellers).where(eq(sellers.sellerCode, code));
    return result[0];
  }
}

export const storage = new DatabaseStorage();
