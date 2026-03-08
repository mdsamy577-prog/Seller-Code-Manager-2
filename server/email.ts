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

  const formattedStart = new Date(startDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const formattedExpiry = new Date(expiryDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">Seller Code Activated</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #374151;">Dear <strong>${sellerName}</strong>,</p>
        <p style="font-size: 15px; color: #4b5563;">Your seller application has been approved. Here are your details:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">Seller Name</td>
            <td style="padding: 12px; color: #4b5563;">${sellerName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb; background-color: #f9fafb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">Seller Code</td>
            <td style="padding: 12px; color: #1e40af; font-weight: bold; font-size: 18px; font-family: monospace;">${sellerCode}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">Start Date</td>
            <td style="padding: 12px; color: #4b5563;">${formattedStart}</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">Expiry Date</td>
            <td style="padding: 12px; color: #4b5563;">${formattedExpiry}</td>
          </tr>
        </table>
        <p style="font-size: 14px; color: #6b7280;">Thank you for joining us!</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${config.senderName}" <${config.senderEmail}>`,
      to: recipientEmail,
      subject: `Your Seller Code: ${sellerCode}`,
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

  const formattedExpiry = new Date(expiryDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const renewalLink = "https://seller-code.onrender.com/apply";

  let subject: string;
  let headerColor: string;
  let headerTitle: string;
  let messageText: string;

  if (reminderType === "before_expiry") {
    const daysLeft = Math.ceil((new Date(expiryDate).getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
    subject = `Subscription Expiring in ${daysLeft} Day${daysLeft > 1 ? 's' : ''} - ${sellerCode}`;
    headerColor = "#f59e0b";
    headerTitle = "Subscription Expiry Reminder";
    messageText = `Your seller subscription will expire in <strong>${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong>. Please renew your subscription to continue using your seller code.`;
  } else if (reminderType === "expiry_day") {
    subject = `Subscription Expired Today - ${sellerCode}`;
    headerColor = "#dc2626";
    headerTitle = "Subscription Expired";
    messageText = `Your seller subscription has <strong>expired today</strong>. Please renew immediately to continue using your seller code.`;
  } else {
    subject = `Subscription Expired - Renew Now - ${sellerCode}`;
    headerColor = "#dc2626";
    headerTitle = "Subscription Expired - Action Required";
    messageText = `Your seller subscription has <strong>expired</strong>. Your seller code is no longer active. Please renew your subscription as soon as possible.`;
  }

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: ${headerColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">${headerTitle}</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #374151;">Dear <strong>${sellerName}</strong>,</p>
        <p style="font-size: 15px; color: #4b5563;">${messageText}</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">Seller Name</td>
            <td style="padding: 12px; color: #4b5563;">${sellerName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb; background-color: #f9fafb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">Seller Code</td>
            <td style="padding: 12px; color: #1e40af; font-weight: bold; font-size: 18px; font-family: monospace;">${sellerCode}</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; font-weight: bold; color: #374151;">Expiry Date</td>
            <td style="padding: 12px; color: ${reminderType === "before_expiry" ? "#f59e0b" : "#dc2626"}; font-weight: bold;">${formattedExpiry}</td>
          </tr>
        </table>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${renewalLink}" style="background-color: #1e40af; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">Renew Subscription</a>
        </div>
        <p style="font-size: 13px; color: #9ca3af; text-align: center;">Click the button above or visit: ${renewalLink}</p>
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
