import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { storage } from "./storage";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", async (req, res) => {
    const url = req.originalUrl;
    const indexPath = path.resolve(distPath, "index.html");

    try {
      let template = await fs.promises.readFile(indexPath, "utf-8");

      let sellerCode = "";
      const verifyMatch = url.match(/\/verify\/([^/?#]+)/);
      if (verifyMatch) {
        sellerCode = decodeURIComponent(verifyMatch[1]);
      } else {
        const queryMatch = url.match(/[?&]verify=([^&#]+)/);
        if (queryMatch) {
          sellerCode = decodeURIComponent(queryMatch[1]);
        }
      }

      if (sellerCode) {
        try {
          const seller = await storage.getSellerByCode(sellerCode);
          if (seller) {
            const ogTitle = `✅ ${seller.name} - ভেরিফাইড সেলার কোড: ${seller.sellerCode}`;
            const phone = seller.phone || "";
            const maskedPhone = phone.length > 5 ? `${phone.slice(0, 3)}***${phone.slice(-3)}` : "***";
            const ogDesc = `🛡️ NID ও মোবাইল ভেরিফাইড সক্রিয় ফেসবুক সেলার। নিবন্ধিত মোবাইল: ${maskedPhone}। লেনদেনের পূর্বে সত্যতা যাচাই করুন।`;

            template = template.replace(/<title>.*?<\/title>/i, `<title>${ogTitle} | সেলার কোড রেজিস্ট্রি</title>`);
            template = template.replace(/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i, `<meta property="og:title" content="${ogTitle}" />`);
            template = template.replace(/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i, `<meta property="og:description" content="${ogDesc}" />`);
            template = template.replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/i, `<meta name="description" content="${ogDesc}" />`);
            template = template.replace(/<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:title" content="${ogTitle}" />`);
            template = template.replace(/<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:description" content="${ogDesc}" />`);
            if (seller.profileImage && !seller.hideProfilePhoto) {
              template = template.replace(/<meta\s+property="og:image"\s+content=".*?"\s*\/?>/i, `<meta property="og:image" content="${seller.profileImage}" />`);
              template = template.replace(/<meta\s+name="twitter:image"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:image" content="${seller.profileImage}" />`);
            }
          }
        } catch {
          // ignore
        }
      }

      res.status(200).set({ "Content-Type": "text/html" }).send(template);
    } catch {
      res.sendFile(indexPath);
    }
  });
}
