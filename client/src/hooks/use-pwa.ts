import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");
    const storedInstalled = localStorage.getItem("pwa_installed") === "true";
    return isStandalone || storedInstalled;
  });
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [installStatus, setInstallStatus] = useState<"idle" | "prompting" | "accepted" | "dismissed">("idle");

  useEffect(() => {
    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Check standalone display mode
    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://");
      if (isStandalone) {
        setIsInstalled(true);
        localStorage.setItem("pwa_installed", "true");
      }
    };
    checkStandalone();

    // Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          registration.addEventListener("updatefound", () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.addEventListener("statechange", () => {
                if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("[PWA] New version ready");
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn("[PWA] Service worker registration warning:", err);
        });
    }

    // Capture beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Capture appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setInstallStatus("accepted");
      localStorage.setItem("pwa_installed", "true");
      console.log("[PWA] App successfully installed on device!");
    };

    // Online/Offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const mql = window.matchMedia("(display-mode: standalone)");
    const handleMql = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        localStorage.setItem("pwa_installed", "true");
      }
    };
    mql.addEventListener("change", handleMql);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      mql.removeEventListener("change", handleMql);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<{ outcome: "accepted" | "dismissed" | "unavailable" }> => {
    if (!deferredPrompt) {
      return { outcome: "unavailable" };
    }

    setInstallStatus("prompting");
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
        setInstallStatus("accepted");
        localStorage.setItem("pwa_installed", "true");
        return { outcome: "accepted" };
      } else {
        setInstallStatus("dismissed");
        return { outcome: "dismissed" };
      }
    } catch (err) {
      console.error("[PWA] prompt error:", err);
      setInstallStatus("dismissed");
      return { outcome: "dismissed" };
    }
  }, [deferredPrompt]);

  return {
    isInstallable: !!deferredPrompt && !isInstalled,
    isInstalled,
    isIOS,
    isOnline,
    installStatus,
    promptInstall,
  };
}
