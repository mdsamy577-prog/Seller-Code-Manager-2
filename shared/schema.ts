import { sql } from "drizzle-orm";
import { pgTable, text, varchar, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  recoveryPhrase: text("recovery_phrase").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  recoveryPhrase: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const sellers = pgTable("sellers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  facebookLink: text("facebook_link").notNull(),
  sellerCode: text("seller_code").notNull().unique(),
  duration: text("duration").notNull(),
  startDate: date("start_date").notNull(),
  expiryDate: date("expiry_date").notNull(),
});

export const insertSellerSchema = createInsertSchema(sellers).pick({
  name: true,
  phone: true,
  facebookLink: true,
  sellerCode: true,
  duration: true,
  startDate: true,
});

export type InsertSeller = z.infer<typeof insertSellerSchema>;
export type Seller = typeof sellers.$inferSelect;

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;

export const sellerApplications = pgTable("seller_applications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  facebookLink: text("facebook_link").notNull(),
  duration: text("duration").notNull().default("1_month"),
  sellerType: text("seller_type").notNull().default("personal_facebook_id"),
  paymentMethod: text("payment_method").notNull().default("bkash"),
  senderNumber: text("sender_number").notNull().default(""),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const insertSellerApplicationSchema = createInsertSchema(sellerApplications).pick({
  name: true,
  phone: true,
  facebookLink: true,
  duration: true,
  sellerType: true,
  paymentMethod: true,
  senderNumber: true,
});

export type InsertSellerApplication = z.infer<typeof insertSellerApplicationSchema>;
export type SellerApplication = typeof sellerApplications.$inferSelect;

