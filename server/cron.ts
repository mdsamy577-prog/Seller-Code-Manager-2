import cron from "node-cron";
import { storage } from "./storage";
import { sendReminderEmail } from "./email";
import { scheduleSellerEmails } from "./scheduler";

async function processEmailSchedule(): Promise<void> {
  try {
    const due = await storage.getPendingScheduledEmails();
    if (due.length === 0) return;

    console.log(`[Email] Processing ${due.length} scheduled email(s)`);

    for (const entry of due) {
      const seller = await storage.getSellerById(entry.sellerId);

      if (!seller || !seller.email || seller.status !== "active") {
        await storage.markScheduledEmailStatus(entry.id, "cancelled");
        continue;
      }

      const success = await sendReminderEmail(
        seller.email,
        seller.name,
        seller.sellerCode,
        seller.expiryDate,
        entry.emailType as "before_expiry" | "expiry_day" | "after_expiry"
      );

      await storage.markScheduledEmailStatus(entry.id, success ? "sent" : "failed");

      console.log(
        `[Email] ${success ? "Sent" : "Failed"}: ${entry.reminderType} → ${seller.name} (${seller.email})`
      );
    }
  } catch (error) {
    console.error("[Email] Error processing email schedule:", error);
  }
}

async function seedSchedulesForExistingSellers(): Promise<void> {
  try {
    const sellers = await storage.getSellersWithEmail();
    let seeded = 0;

    for (const seller of sellers) {
      const hasPending = await storage.hasPendingScheduleForSeller(seller.id);
      if (!hasPending) {
        await scheduleSellerEmails(seller);
        seeded++;
      }
    }

    if (seeded > 0) {
      console.log(`[Scheduler] Seeded email schedules for ${seeded} existing seller(s)`);
    } else {
      console.log(`[Scheduler] All sellers already have scheduled emails`);
    }
  } catch (error) {
    console.error("[Scheduler] Error seeding schedules:", error);
  }
}

export function startCronJobs(): void {
  cron.schedule("*/5 * * * *", () => {
    processEmailSchedule();
  });

  console.log("[Cron] Email schedule processor started (checks every 5 minutes)");

  setTimeout(() => {
    seedSchedulesForExistingSellers();
  }, 5000);
}
