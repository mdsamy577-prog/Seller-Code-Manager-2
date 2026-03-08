import cron from "node-cron";
import { storage } from "./storage";
import { sendReminderEmail } from "./email";

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getDaysDifference(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getReminderType(daysUntilExpiry: number): { type: string; emailType: "before_expiry" | "expiry_day" | "after_expiry" } | null {
  if (daysUntilExpiry >= 1 && daysUntilExpiry <= 3) {
    return { type: `before_${daysUntilExpiry}`, emailType: "before_expiry" };
  }

  if (daysUntilExpiry === 0) {
    return { type: "expiry_day", emailType: "expiry_day" };
  }

  if (daysUntilExpiry < 0) {
    const daysAfter = Math.abs(daysUntilExpiry);

    if (daysAfter <= 4) {
      return { type: `after_${daysAfter}`, emailType: "after_expiry" };
    }

    if (daysAfter % 7 === 0) {
      return { type: `weekly_${daysAfter}`, emailType: "after_expiry" };
    }
  }

  return null;
}

async function checkExpiringSellers(): Promise<void> {
  console.log(`[Cron] Running subscription reminder check at ${new Date().toISOString()}`);

  try {
    const sellers = await storage.getSellersWithEmail();
    const todayStr = getTodayString();
    let sentCount = 0;
    let skippedCount = 0;

    for (const seller of sellers) {
      if (!seller.email || !seller.expiryDate) continue;

      const daysUntilExpiry = getDaysDifference(seller.expiryDate);
      const reminder = getReminderType(daysUntilExpiry);

      if (!reminder) continue;

      const alreadySent = await storage.hasReminderBeenSent(seller.id, reminder.type, todayStr);
      if (alreadySent) {
        skippedCount++;
        continue;
      }

      const success = await sendReminderEmail(
        seller.email,
        seller.name,
        seller.sellerCode,
        seller.expiryDate,
        reminder.emailType
      );

      if (success) {
        await storage.logReminderSent(seller.id, reminder.type, todayStr);
        sentCount++;
      }
    }

    console.log(`[Cron] Reminder check complete. Sent: ${sentCount}, Skipped (already sent): ${skippedCount}, Total sellers with email: ${sellers.length}`);
  } catch (error) {
    console.error("[Cron] Error in subscription reminder check:", error);
  }
}

export function startCronJobs(): void {
  cron.schedule("0 9 * * *", () => {
    checkExpiringSellers();
  });

  console.log("[Cron] Subscription reminder cron job scheduled (daily at 9:00 AM)");
}
