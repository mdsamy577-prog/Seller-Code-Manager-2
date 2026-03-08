import nodemailer from "nodemailer";
import { storage } from "./storage";

interface EmailConfig {
  senderEmail: string;
  emailAppPassword: string;
  senderName: string;
}

async function getEmailConfig(): Promise<EmailConfig | null> {
  const settings = await storage.getSettings([
    "SENDER_EMAIL",
    "EMAIL_APP_PASSWORD",
    "SENDER_NAME",
  ]);

  if (!settings.SENDER_EMAIL || !settings.EMAIL_APP_PASSWORD) {
    return null;
  }

  return {
    senderEmail: settings.SENDER_EMAIL,
    emailAppPassword: settings.EMAIL_APP_PASSWORD,
    senderName: settings.SENDER_NAME || "Seller Code Manager",
  };
}

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
  const config = await getEmailConfig();
  if (!config) {
    console.log("Email not configured, skipping email notification");
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: config.senderEmail,
      pass: config.emailAppPassword,
    },
  });

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
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${config.senderName}" <${config.senderEmail}>`,
      to: recipientEmail,
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

export async function sendReminderEmail(
  recipientEmail: string,
  sellerName: string,
  sellerCode: string,
  expiryDate: string,
  reminderType: "before_expiry" | "expiry_day" | "after_expiry"
): Promise<boolean> {
  const config = await getEmailConfig();
  if (!config) {
    console.log("Email not configured, skipping reminder");
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: config.senderEmail,
      pass: config.emailAppPassword,
    },
  });

  const formattedExpiry = formatDateBangla(expiryDate);
  const renewalLink = "https://seller-code.onrender.com/apply";

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
          <a href="${renewalLink}" style="background-color: #1e40af; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">\u09B8\u09BE\u09AC\u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09AA\u09B6\u09A8 \u09A8\u09AC\u09BE\u09AF\u09BC\u09A8 \u0995\u09B0\u09C1\u09A8</a>
        </div>
        <p style="font-size: 13px; color: #9ca3af; text-align: center;">\u0989\u09AA\u09B0\u09C7\u09B0 \u09AC\u09BE\u099F\u09A8\u09C7 \u0995\u09CD\u09B2\u09BF\u0995 \u0995\u09B0\u09C1\u09A8 \u0985\u09A5\u09AC\u09BE \u09AD\u09BF\u099C\u09BF\u099F \u0995\u09B0\u09C1\u09A8: ${renewalLink}</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${config.senderName}" <${config.senderEmail}>`,
      to: recipientEmail,
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
