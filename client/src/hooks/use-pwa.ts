import { useEffect } from "react";
import { useLocation } from "wouter";

export function usePWA() {
  const [location] = useLocation();
  const isPWARoute = location !== "/apply";

  useEffect(() => {
    const existingLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;

    if (!isPWARoute) {
      if (existingLink) existingLink.remove();
      return;
    }

    if (!existingLink) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/manifest.json";
      document.head.appendChild(link);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("SW registration failed:", err);
      });
    }
  }, [isPWARoute]);
}
