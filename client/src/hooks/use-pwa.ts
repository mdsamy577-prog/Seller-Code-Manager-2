import { useEffect } from "react";

export function usePWA() {
  useEffect(() => {
    let existingLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!existingLink) {
      existingLink = document.createElement("link");
      existingLink.rel = "manifest";
      existingLink.href = "/manifest.json";
      document.head.appendChild(existingLink);
    }

    if ("serviceWorker" in navigator) {
      if (import.meta.env.DEV) {
        return;
      }

      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("SW registration failed:", err);
      });
    }
  }, []);
}
