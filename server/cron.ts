import cron from "node-cron";
import { storage } from "./storage";
import { sendReminderEmail } from "./email";
import { scheduleSellerEmails } from "./scheduler";

/**
 * Checks all active sellers and auto-archives those whose expiryDate has arrived or passed.
 * Regardless of whether the email succeeds, fails, or if the seller has no email:
 * ALWAYS immediately executes storage.softDeleteSeller(seller.id).
 */
export async function checkAndArchiveExpiredSellers(): Promise<void> {
  try {
    const activeSellers = await storage.getAllSellers();
    if (!activeSellers || activeSellers.length === 0) return;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    for (const seller of activeSellers) {
      if (seller.status !== "active") continue;

      const isDateExpired = !seller.expiryDate || seller.expiryDate <= todayStr || new Date(seller.expiryDate).getTime() <= now.getTime();

      if (isDateExpired) {
        console.log(`[Auto-Archive] Found expired active seller: ${seller.name} (Code: ${seller.sellerCode}, Expiry: ${seller.expiryDate})`);

        // If the seller has an email and hasn't been notified yet for expiry_day, attempt to send
        if (seller.email) {
          try {
            const alreadySent = await storage.hasReminderBeenSent(seller.id, "expiry_day", todayStr);
            if (!alreadySent) {
              const success = await sendReminderEmail(
                seller.email,
                seller.name,
                seller.sellerCode,
                seller.expiryDate,
                "expiry_day"
              );
              await storage.logReminderSent(seller.id, "expiry_day", todayStr);
              console.log(
                `[Auto-Archive] ${success ? "✓ Sent" : "✗ Failed"} expiry email to ${seller.name} (${seller.email})`
              );
            }
          } catch (emailErr) {
            console.error(`[Auto-Archive] Error sending expiry email to ${seller.name}:`, emailErr);
          }
        }

        // CRITICAL: Regardless of whether the email succeeds, fails, or if the seller has no email at all:
        // ALWAYS immediately execute storage.softDeleteSeller(seller.id)
        await storage.softDeleteSeller(seller.id);
        console.log(`[Auto-Archive] Automatically moved seller ${seller.name} (ID: ${seller.id}, Code: ${seller.sellerCode}) to Expired Sellers list`);
      }
    }
  } catch (err) {
    console.error("[Auto-Archive] Error in checkAndArchiveExpiredSellers:", err);
  }
}

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

      // Auto-archive on expiry_day regardless of email outcome
      if (entry.emailType === "expiry_day") {
        await storage.softDeleteSeller(seller.id);
        console.log(`[Scheduler] Auto-archived seller on expiry-day: ${seller.name} (ID: ${seller.id})`);
      }

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

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    for (const seller of sellers) {
      if (seller.status !== "active" || seller.expiryDate <= todayStr) {
        skipped++;
        continue;
      }
      await scheduleSellerEmails(seller);
      seeded++;
    }

    console.log(`[Scheduler] Startup seed complete — re-seeded: ${seeded}, skipped: ${skipped}, total active sellers with email: ${sellers.length}`);
  } catch (error) {
    console.error("[Scheduler] Error seeding schedules:", error);
  }
}

export function startCronJobs(): void {
  // Immediately check and archive any expired sellers on boot
  checkAndArchiveExpiredSellers();

  cron.schedule("*/5 * * * *", async () => {
    await checkAndArchiveExpiredSellers();
    await processEmailSchedule();
  });

  console.log("[Cron] Auto-archive and email schedule processor started (checks every 5 minutes)");

  setTimeout(() => {
    seedSchedulesForExistingSellers();
  }, 5000);
}

