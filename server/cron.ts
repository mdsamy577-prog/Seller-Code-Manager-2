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

    if (sellers.length === 0) {
      console.log(`[Scheduler] No sellers with email addresses found — nothing to seed`);
      return;
    }

    let seeded = 0;
    let alreadyScheduled = 0;

    for (const seller of sellers) {
      const hasPending = await storage.hasPendingScheduleForSeller(seller.id);
      if (!hasPending) {
        await scheduleSellerEmails(seller);
        seeded++;
      } else {
        alreadyScheduled++;
      }
    }

    console.log(`[Scheduler] Startup seed complete — seeded: ${seeded}, already scheduled: ${alreadyScheduled}, total sellers with email: ${sellers.length}`);
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
