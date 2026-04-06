import { sql } from "drizzle-orm";
import { pgTable, text, varchar, date, integer, uniqueIndex } from "drizzle-orm/pg-core";
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
  email: text("email"),
  status: text("status").notNull().default("active"),
});

export const emailReminderLog = pgTable("email_reminder_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sellerId: integer("seller_id").notNull(),
  reminderType: text("reminder_type").notNull(),
  sentDate: text("sent_date").notNull(),
}, (table) => [
  uniqueIndex("unique_reminder_per_day").on(table.sellerId, table.reminderType, table.sentDate),
]);

export const insertSellerSchema = createInsertSchema(sellers).pick({
  name: true,
  phone: true,
  facebookLink: true,
  sellerCode: true,
  duration: true,
  startDate: true,
  email: true,
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
  email: text("email"),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  nidFileUrl: text("nid_file_url"),
});

export const insertSellerApplicationSchema = createInsertSchema(sellerApplications).pick({
  name: true,
  phone: true,
  facebookLink: true,
  duration: true,
  sellerType: true,
  paymentMethod: true,
  senderNumber: true,
  email: true,
  nidFileUrl: true,
});

export type InsertSellerApplication = z.infer<typeof insertSellerApplicationSchema>;
export type SellerApplication = typeof sellerApplications.$inferSelect;

export const sellerRenewalApplications = pgTable("seller_renewal_applications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sellerId: integer("seller_id").notNull(),
  phone: text("phone").notNull(),
  duration: text("duration").notNull(),
  paymentMethod: text("payment_method").notNull(),
  senderNumber: text("sender_number").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const insertSellerRenewalApplicationSchema = createInsertSchema(sellerRenewalApplications).pick({
  sellerId: true,
  phone: true,
  duration: true,
  paymentMethod: true,
  senderNumber: true,
});

export type InsertSellerRenewalApplication = z.infer<typeof insertSellerRenewalApplicationSchema>;
export type SellerRenewalApplication = typeof sellerRenewalApplications.$inferSelect;

export const emailSchedule = pgTable("email_schedule", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sellerId: integer("seller_id").notNull(),
  sendAt: text("send_at").notNull(),
  reminderType: text("reminder_type").notNull(),
  emailType: text("email_type").notNull(),
  status: text("status").notNull().default("pending"),
});

export type EmailScheduleEntry = typeof emailSchedule.$inferSelect;

