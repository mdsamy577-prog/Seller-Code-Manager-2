import { storage } from "./storage";
import type { Seller } from "@shared/schema";

interface ScheduleEntry {
  sellerId: number;
  sendAt: string;
  reminderType: string;
  emailType: string;
}

function buildEmailSchedule(seller: Seller, referenceTime: Date): ScheduleEntry[] {
  if (!seller.email) return [];

  const hours = referenceTime.getUTCHours();
  const minutes = referenceTime.getUTCMinutes();

  const [y, m, d] = seller.expiryDate.split("-").map(Number);
  const expiryDateTime = new Date(Date.UTC(y, m - 1, d, hours, minutes, 0));

  const now = new Date();

  if (expiryDateTime <= now) return [];

  return [
    {
      sellerId: seller.id,
      sendAt: expiryDateTime.toISOString(),
      reminderType: "expiry_day",
      emailType: "expiry_day",
    },
  ];
}

export async function scheduleSellerEmails(seller: Seller, referenceTime: Date = new Date()): Promise<void> {
  if (!seller.email) return;

  await storage.cancelPendingEmailsForSeller(seller.id);

  const entries = buildEmailSchedule(seller, referenceTime);
  if (entries.length > 0) {
    await storage.createEmailScheduleEntries(entries);
    console.log(`[Scheduler] Scheduled expiry-day email for seller: ${seller.name} (expiry: ${seller.expiryDate})`);
  } else {
    console.log(`[Scheduler] No future expiry-day email to schedule for seller: ${seller.name} (expiry: ${seller.expiryDate})`);
  }
}
