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
      if (import.meta.env.DEV) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
        if ("caches" in window) {
          caches.keys().then((keys) => {
            for (const key of keys) {
              caches.delete(key);
            }
          });
        }
        return;
      }

      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("SW registration failed:", err);
      });
    }
  }, [isPWARoute]);
}
