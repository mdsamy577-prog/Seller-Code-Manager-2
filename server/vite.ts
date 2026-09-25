import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { storage } from "./storage";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      const cacheBust = Math.random().toString(36).substring(2, 8);
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${cacheBust}"`,
      );

      // Dynamically inject OpenGraph tags for /verify/:code or ?verify=CODE
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

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
