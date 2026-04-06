import { Resend } from "resend";
import { storage } from "./storage";

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

async function getSenderName(): Promise<string> {
  const name = await storage.getSetting("SENDER_NAME");
  return name || "CPS&S Seller Code";
}

async function getReplyEmail(): Promise<string | undefined> {
  const email = await storage.getSetting("REPLY_EMAIL");
  return email || undefined;
}

const BASE_URL = "https://seller-code.onrender.com";

function formatDateBangla(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("bn-BD", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export async function sendSellerCodeEmail(
  recipientEmail: string,
  sellerName: string,
  sellerCode: string,
  startDate: string,
  expiryDate: string
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY not configured, skipping email notification");
    return false;
  }

  const senderName = await getSenderName();
  const replyTo = await getReplyEmail();
  const formattedStart = formatDateBangla(startDate);
  const formattedExpiry = formatDateBangla(expiryDate);

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">\u09B8\u09C7\u09B2\u09BE\u09B0 \u0995\u09CB\u09A1 \u09B8\u0995\u09CD\u09B0\u09BF\u09AF\u09BC \u09B9\u09AF\u09BC\u09C7\u099B\u09C7</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #374151;">\u09AA\u09CD\u09B0\u09BF\u09AF\u09BC <strong>${sellerName}</strong>,</p>
        <p style="font-size: 15px; color: #4b5563;">\u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u09C7\u09B2\u09BE\u09B0 \u0986\u09AC\u09C7\u09A6\u09A8 \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09A8 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964 \u09A8\u09BF\u099A\u09C7 \u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u09C7\u09B2\u09BE\u09B0 \u09A4\u09A5\u09CD\u09AF \u09A6\u09C7\u0993\u09AF\u09BC\u09BE \u09B9\u09B2\u09CB:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">\u09B8\u09C7\u09B2\u09BE\u09B0 \u09A8\u09BE\u09AE</td>
            <td style="padding: 12px; color: #4b5563;">${sellerName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb; background-color: #f9fafb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">\u09B8\u09C7\u09B2\u09BE\u09B0 \u0995\u09CB\u09A1</td>
            <td style="padding: 12px; color: #1e40af; font-weight: bold; font-size: 18px; font-family: monospace;">${sellerCode}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">\u09B6\u09C1\u09B0\u09C1\u09B0 \u09A4\u09BE\u09B0\u09BF\u0996</td>
            <td style="padding: 12px; color: #4b5563;">${formattedStart}</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">\u09AE\u09C7\u09AF\u09BC\u09BE\u09A6 \u09B6\u09C7\u09B7</td>
            <td style="padding: 12px; color: #4b5563;">${formattedExpiry}</td>
          </tr>
        </table>
        <p style="font-size: 14px; color: #6b7280;">\u0986\u09AE\u09BE\u09A6\u09C7\u09B0 \u09B8\u09BE\u09A5\u09C7 \u09AF\u09C1\u0995\u09CD\u09A4 \u09B9\u0993\u09AF\u09BC\u09BE\u09B0 \u099C\u09A8\u09CD\u09AF \u09A7\u09A8\u09CD\u09AF\u09AC\u09BE\u09A6\u0964</p>
        <div style="border-top: 1px solid #e5e7eb; margin-top: 20px; padding-top: 16px; text-align: center;">
          <p style="font-size: 13px; color: #9ca3af; margin: 0 0 8px 0;">\u09B8\u09BE\u09AA\u09CB\u09B0\u09CD\u099F\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF \u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8</p>
          <a href="https://www.facebook.com/CPSSbd.1" style="background-color: #1877f2; color: white; padding: 8px 20px; text-decoration: none; border-radius: 5px; font-size: 14px; font-weight: bold; display: inline-block;">Facebook Page</a>
        </div>
      </div>
    </div>
  `;

  const resend = getResendClient();
  if (!resend) return false;

  try {
    await resend.emails.send({
      from: `${senderName} <noreply@seller-code.onrender.com>`,
      to: recipientEmail,
      replyTo,
      subject: `\u09B8\u09C7\u09B2\u09BE\u09B0 \u0995\u09CB\u09A1: ${sellerCode}`,
      html: htmlBody,
    });
    console.log(`Seller code email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export async function sendExtensionEmail(
  recipientEmail: string,
  sellerName: string,
  sellerCode: string,
  oldExpiryDate: string,
  newExpiryDate: string,
  months: number
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY not configured, skipping extension email");
    return false;
  }

  const senderName = await getSenderName();
  const replyTo = await getReplyEmail();
  const formattedOld = formatDateBangla(oldExpiryDate);
  const formattedNew = formatDateBangla(newExpiryDate);

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #16a34a; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">সাবস্ক্রিপশন বাড়ানো হয়েছে</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #374151;">প্রিয় <strong>${sellerName}</strong>,</p>
        <p style="font-size: 15px; color: #4b5563;">আপনার সেলার সাবস্ক্রিপশন সফলভাবে <strong>${months} মাস</strong> বাড়ানো হয়েছে।</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">সেলার নাম</td>
            <td style="padding: 12px; color: #4b5563;">${sellerName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb; background-color: #f9fafb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">সেলার কোড</td>
            <td style="padding: 12px; color: #1e40af; font-weight: bold; font-size: 18px; font-family: monospace;">${sellerCode}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">পূর্বের মেয়াদ শেষ</td>
            <td style="padding: 12px; color: #6b7280;">${formattedOld}</td>
          </tr>
          <tr style="background-color: #f0fdf4;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">নতুন মেয়াদ শেষ</td>
            <td style="padding: 12px; color: #16a34a; font-weight: bold;">${formattedNew}</td>
          </tr>
        </table>
        <p style="font-size: 14px; color: #6b7280;">আমাদের সাথে থাকার জন্য ধন্যবাদ।</p>
        <div style="border-top: 1px solid #e5e7eb; margin-top: 20px; padding-top: 16px; text-align: center;">
          <p style="font-size: 13px; color: #9ca3af; margin: 0 0 8px 0;">সাপোর্টের জন্য যোগাযোগ করুন</p>
          <a href="https://www.facebook.com/CPSSbd.1" style="background-color: #1877f2; color: white; padding: 8px 20px; text-decoration: none; border-radius: 5px; font-size: 14px; font-weight: bold; display: inline-block;">Facebook Page</a>
        </div>
      </div>
    </div>
  `;

  const resend = getResendClient();
  if (!resend) return false;

  try {
    await resend.emails.send({
      from: `${senderName} <noreply@seller-code.onrender.com>`,
      to: recipientEmail,
      replyTo,
      subject: `সাবস্ক্রিপশন বাড়ানো হয়েছে: ${sellerCode}`,
      html: htmlBody,
    });
    console.log(`Extension email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error("Failed to send extension email:", error);
    return false;
  }
}

export async function sendReminderEmail(
  recipientEmail: string,
  sellerName: string,
  sellerCode: string,
  expiryDate: string,
  reminderType: "before_expiry" | "expiry_day" | "after_expiry"
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY not configured, skipping reminder");
    return false;
  }

  const senderName = await getSenderName();
  const replyTo = await getReplyEmail();
  const formattedExpiry = formatDateBangla(expiryDate);
  const renewalLink = `${BASE_URL}/renew`;

  let subject: string;
  let headerColor: string;
  let headerTitle: string;
  let messageText: string;
  let expiryLabel: string;

  if (reminderType === "before_expiry") {
    const daysLeft = Math.ceil((new Date(expiryDate).getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
    subject = `\u09B8\u09BE\u09AC\u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09AA\u09B6\u09A8 ${daysLeft} \u09A6\u09BF\u09A8\u09C7 \u09B6\u09C7\u09B7 \u09B9\u09AC\u09C7 - ${sellerCode}`;
    headerColor = "#f59e0b";
    headerTitle = "\u09B8\u09BE\u09AC\u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09AA\u09B6\u09A8 \u09AE\u09C7\u09AF\u09BC\u09BE\u09A6 \u09B6\u09C7\u09B7 \u09B9\u0993\u09AF\u09BC\u09BE\u09B0 \u09B8\u09A4\u09B0\u09CD\u0995\u09AC\u09BE\u09B0\u09CD\u09A4\u09BE";
    messageText = `\u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u09C7\u09B2\u09BE\u09B0 \u09B8\u09BE\u09AC\u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09AA\u09B6\u09A8 \u0986\u09B0 <strong>${daysLeft} \u09A6\u09BF\u09A8\u09C7</strong> \u09B6\u09C7\u09B7 \u09B9\u09A4\u09C7 \u09AF\u09BE\u099A\u09CD\u099B\u09C7\u0964 \u09B8\u09C7\u09B2\u09BE\u09B0 \u0995\u09CB\u09A1 \u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0 \u099A\u09BE\u09B2\u09BF\u09AF\u09BC\u09C7 \u09AF\u09C7\u09A4\u09C7 \u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 \u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u09BE\u09AC\u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09AA\u09B6\u09A8 \u09A8\u09AC\u09BE\u09AF\u09BC\u09A8 \u0995\u09B0\u09C1\u09A8\u0964`;
    expiryLabel = "\u09AE\u09C7\u09AF\u09BC\u09BE\u09A6 \u09B6\u09C7\u09B7\u09C7\u09B0 \u09A4\u09BE\u09B0\u09BF\u0996";
  } else if (reminderType === "expiry_day") {
    subject = `\u09B8\u09BE\u09AC\u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09AA\u09B6\u09A8 \u0986\u099C \u09B6\u09C7\u09B7 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7 - ${sellerCode}`;
    headerColor = "#dc2626";
    headerTitle = "\u09B8\u09BE\u09AC\u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09AA\u09B6\u09A8 \u09AE\u09C7\u09AF\u09BC\u09BE\u09A6 \u09B6\u09C7\u09B7 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7";
    messageText = `\u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u09C7\u09B2\u09BE\u09B0 \u09B8\u09BE\u09AC\u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09AA\u09B6\u09A8 <strong>\u0986\u099C \u09B6\u09C7\u09B7 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7</strong>\u0964 \u09B8\u09C7\u09B2\u09BE\u09B0 \u0995\u09CB\u09A1 \u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0 \u099A\u09BE\u09B2\u09BF\u09AF\u09BC\u09C7 \u09AF\u09C7\u09A4\u09C7 \u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 \u098F\u0996\u09A8\u0987 \u09A8\u09AC\u09BE\u09AF\u09BC\u09A8 \u0995\u09B0\u09C1\u09A8\u0964`;
    expiryLabel = "\u09AE\u09C7\u09AF\u09BC\u09BE\u09A6 \u09B6\u09C7\u09B7 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7";
  } else {
    subject = `\u09B8\u09BE\u09AC\u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09AA\u09B6\u09A8 \u09B6\u09C7\u09B7 - \u09A8\u09AC\u09BE\u09AF\u09BC\u09A8 \u0995\u09B0\u09C1\u09A8 - ${sellerCode}`;
    headerColor = "#dc2626";
    headerTitle = "\u09B8\u09BE\u09AC\u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09AA\u09B6\u09A8 \u09AE\u09C7\u09AF\u09BC\u09BE\u09A6 \u09B6\u09C7\u09B7 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7";
    messageText = `\u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u09C7\u09B2\u09BE\u09B0 \u09B8\u09BE\u09AC\u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09AA\u09B6\u09A8 \u09B6\u09C7\u09B7 \u09B9\u09AF\u09BC\u09C7 \u0997\u09C7\u099B\u09C7 \u098F\u09AC\u0982 \u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u09C7\u09B2\u09BE\u09B0 \u0995\u09CB\u09A1 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8\u09C7 <strong>\u09B8\u0995\u09CD\u09B0\u09BF\u09AF\u09BC \u09A8\u09AF\u09BC</strong>\u0964 \u09AA\u09C1\u09A8\u09B0\u09BE\u09AF\u09BC \u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0 \u0995\u09B0\u09A4\u09C7 \u099A\u09BE\u0987\u09B2\u09C7 \u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 \u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u09BE\u09AC\u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09AA\u09B6\u09A8 \u09A8\u09AC\u09BE\u09AF\u09BC\u09A8 \u0995\u09B0\u09C1\u09A8\u0964`;
    expiryLabel = "\u09AE\u09C7\u09AF\u09BC\u09BE\u09A6 \u09B6\u09C7\u09B7 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7";
  }

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: ${headerColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">${headerTitle}</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #374151;">\u09AA\u09CD\u09B0\u09BF\u09AF\u09BC <strong>${sellerName}</strong>,</p>
        <p style="font-size: 15px; color: #4b5563;">${messageText}</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">\u09B8\u09C7\u09B2\u09BE\u09B0 \u09A8\u09BE\u09AE</td>
            <td style="padding: 12px; color: #4b5563;">${sellerName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb; background-color: #f9fafb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">\u09B8\u09C7\u09B2\u09BE\u09B0 \u0995\u09CB\u09A1</td>
            <td style="padding: 12px; color: #1e40af; font-weight: bold; font-size: 18px; font-family: monospace;">${sellerCode}</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">${expiryLabel}</td>
            <td style="padding: 12px; color: ${reminderType === "before_expiry" ? "#f59e0b" : "#dc2626"}; font-weight: bold;">${formattedExpiry}</td>
          </tr>
        </table>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${renewalLink}" style="background-color: #1e40af; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">সাবস্ক্রিপশন নবায়ন করুন</a>
        </div>
        <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 14px 16px; margin: 0 0 12px 0;">
          <p style="margin: 0 0 6px 0; font-size: 13px; color: #374151; font-weight: bold;">নবায়ন করতে ক্লিক করুন:</p>
          <a href="${renewalLink}" style="font-size: 13px; color: #1e40af; word-break: break-all;">${renewalLink}</a>
        </div>
        <div style="border-top: 1px solid #e5e7eb; margin-top: 20px; padding-top: 16px; text-align: center;">
          <p style="font-size: 13px; color: #9ca3af; margin: 0 0 8px 0;">\u09B8\u09BE\u09AA\u09CB\u09B0\u09CD\u099F\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF \u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8</p>
          <a href="https://www.facebook.com/CPSSbd.1" style="background-color: #1877f2; color: white; padding: 8px 20px; text-decoration: none; border-radius: 5px; font-size: 14px; font-weight: bold; display: inline-block;">Facebook Page</a>
        </div>
      </div>
    </div>
  `;

  const resend = getResendClient();
  if (!resend) return false;

  try {
    await resend.emails.send({
      from: `${senderName} <noreply@seller-code.onrender.com>`,
      to: recipientEmail,
      replyTo,
      subject,
      html: htmlBody,
    });
    console.log(`Reminder email sent to ${recipientEmail} (${reminderType})`);
    return true;
  } catch (error) {
    console.error(`Failed to send reminder email to ${recipientEmail}:`, error);
    return false;
  }
}

export async function sendRenewalApprovalEmail(
  recipientEmail: string,
  sellerName: string,
  sellerCode: string,
  newExpiryDate: string
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY not configured, skipping renewal approval email");
    return false;
  }

  const senderName = await getSenderName();
  const replyTo = await getReplyEmail();
  const formattedExpiry = formatDateBangla(newExpiryDate);

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #16a34a; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">সাবস্ক্রিপশন নবায়ন সম্পন্ন</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #374151;">প্রিয় <strong>${sellerName}</strong>,</p>
        <p style="font-size: 15px; color: #4b5563;">আপনার সেলার কোডের মেয়াদ সফলভাবে নবায়ন করা হয়েছে।</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">সেলার নাম</td>
            <td style="padding: 12px; color: #4b5563;">${sellerName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb; background-color: #f9fafb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">সেলার কোড</td>
            <td style="padding: 12px; color: #1e40af; font-weight: bold; font-size: 18px; font-family: monospace;">${sellerCode}</td>
          </tr>
          <tr style="background-color: #f0fdf4;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">নতুন মেয়াদ শেষ</td>
            <td style="padding: 12px; color: #16a34a; font-weight: bold;">${formattedExpiry}</td>
          </tr>
        </table>
        <div style="border-top: 1px solid #e5e7eb; margin-top: 20px; padding-top: 16px; text-align: center;">
          <p style="font-size: 13px; color: #9ca3af; margin: 0 0 8px 0;">সাপোর্টের জন্য যোগাযোগ করুন</p>
          <a href="https://www.facebook.com/CPSSbd.1" style="background-color: #1877f2; color: white; padding: 8px 20px; text-decoration: none; border-radius: 5px; font-size: 14px; font-weight: bold; display: inline-block;">Facebook Page</a>
        </div>
      </div>
    </div>
  `;

  const resend = getResendClient();
  if (!resend) return false;

  try {
    await resend.emails.send({
      from: `${senderName} <noreply@seller-code.onrender.com>`,
      to: recipientEmail,
      replyTo,
      subject: `সাবস্ক্রিপশন নবায়ন সম্পন্ন: ${sellerCode}`,
      html: htmlBody,
    });
    console.log(`Renewal approval email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`Failed to send renewal approval email to ${recipientEmail}:`, error);
    return false;
  }
}

export async function sendRenewalRejectionEmail(
  recipientEmail: string,
  sellerName: string,
  sellerCode: string
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY not configured, skipping renewal rejection email");
    return false;
  }

  const senderName = await getSenderName();
  const replyTo = await getReplyEmail();

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">নবায়ন আবেদন বাতিল হয়েছে</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #374151;">প্রিয় <strong>${sellerName}</strong>,</p>
        <p style="font-size: 15px; color: #4b5563;">দুঃখিত, আপনার সাবস্ক্রিপশন নবায়নের আবেদনটি গ্রহণ করা সম্ভব হয়নি।</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">সেলার নাম</td>
            <td style="padding: 12px; color: #4b5563;">${sellerName}</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">সেলার কোড</td>
            <td style="padding: 12px; color: #1e40af; font-weight: bold; font-size: 18px; font-family: monospace;">${sellerCode}</td>
          </tr>
        </table>
        <p style="font-size: 15px; color: #374151;">অনুগ্রহ করে সঠিক তথ্য দিয়ে পুনরায় আবেদন করুন।</p>
        <div style="border-top: 1px solid #e5e7eb; margin-top: 20px; padding-top: 16px; text-align: center;">
          <p style="font-size: 13px; color: #9ca3af; margin: 0 0 8px 0;">সাপোর্টের জন্য যোগাযোগ করুন</p>
          <a href="https://www.facebook.com/CPSSbd.1" style="background-color: #1877f2; color: white; padding: 8px 20px; text-decoration: none; border-radius: 5px; font-size: 14px; font-weight: bold; display: inline-block;">Facebook Page</a>
        </div>
      </div>
    </div>
  `;

  const resend = getResendClient();
  if (!resend) return false;

  try {
    await resend.emails.send({
      from: `${senderName} <noreply@seller-code.onrender.com>`,
      to: recipientEmail,
      replyTo,
      subject: `নবায়ন আবেদন বাতিল: ${sellerCode}`,
      html: htmlBody,
    });
    console.log(`Renewal rejection email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`Failed to send renewal rejection email to ${recipientEmail}:`, error);
    return false;
  }
}
