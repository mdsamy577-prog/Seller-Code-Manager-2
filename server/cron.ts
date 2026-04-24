import cron from "node-cron";
import { storage } from "./storage";
import { sendReminderEmail } from "./email";
import { scheduleSellerEmails } from "./scheduler";

async function processEmailSchedule(): Promise<void> {
  console.log(`[Scheduler] Checking email queue at ${new Date().toISOString()}`);

  let due: Awaited<ReturnType<typeof storage.getPendingScheduledEmails>>;

  try {
    due = await storage.getPendingScheduledEmails();
  } catch (err) {
    console.error("[Scheduler] Failed to query email queue — will retry next cycle:", err);
    return;
  }

  console.log(`[Scheduler] Emails due: ${due.length}`);
  if (due.length === 0) return;

  for (const entry of due) {
    try {
      const seller = await storage.getSellerById(entry.sellerId);

      if (!seller || !seller.email) {
        await storage.markScheduledEmailStatus(entry.id, "cancelled");
        console.log(`[Scheduler] Cancelled entry ${entry.id} (seller not found or no email)`);
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
        `[Scheduler] ${success ? "✓ Sent" : "✗ Failed"}: ${entry.reminderType} → ${seller.name} (${seller.email})`
      );
    } catch (err) {
      console.error(`[Scheduler] Error processing entry ${entry.id} — skipping:`, err);
    }
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
    let skipped = 0;

    for (const seller of sellers) {
      // Always cancel and re-seed so any old-style (before/after/weekly)
      // pending entries are replaced with just the single expiry-day email.
      await scheduleSellerEmails(seller);
      seeded++;
    }

    console.log(`[Scheduler] Startup seed complete — re-seeded: ${seeded}, skipped: ${skipped}, total sellers with email: ${sellers.length}`);
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
