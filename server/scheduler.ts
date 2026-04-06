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
  const entries: ScheduleEntry[] = [];

  const addEntry = (daysOffset: number, reminderType: string, emailType: string) => {
    const sendAt = new Date(expiryDateTime);
    sendAt.setUTCDate(sendAt.getUTCDate() + daysOffset);
    if (sendAt > now) {
      entries.push({ sellerId: seller.id, sendAt: sendAt.toISOString(), reminderType, emailType });
    }
  };

  addEntry(-3, "before_3", "before_expiry");
  addEntry(-2, "before_2", "before_expiry");
  addEntry(-1, "before_1", "before_expiry");
  addEntry(0, "expiry_day", "expiry_day");
  addEntry(1, "after_1", "after_expiry");
  addEntry(2, "after_2", "after_expiry");
  addEntry(3, "after_3", "after_expiry");
  addEntry(4, "after_4", "after_expiry");

  for (let week = 1; week <= 8; week++) {
    addEntry(week * 7, `weekly_${week * 7}`, "after_expiry");
  }

  return entries;
}

export async function scheduleSellerEmails(seller: Seller, referenceTime: Date = new Date()): Promise<void> {
  if (!seller.email) return;

  await storage.cancelPendingEmailsForSeller(seller.id);

  const entries = buildEmailSchedule(seller, referenceTime);
  if (entries.length > 0) {
    await storage.createEmailScheduleEntries(entries);
    console.log(`[Scheduler] Scheduled ${entries.length} emails for seller: ${seller.name} (expiry: ${seller.expiryDate})`);
  }
}
