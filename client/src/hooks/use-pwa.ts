import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const path = window.location.pathname;
    return path.startsWith("/.tanny.admin") || path.startsWith("/tanny-admin");
  });

  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");
    const storedInstalled = localStorage.getItem("pwa_admin_installed") === "true";
    return isStandalone || storedInstalled;
  });

  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [installStatus, setInstallStatus] = useState<"idle" | "prompting" | "accepted" | "dismissed">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if current route is an admin route
    const checkRoute = () => {
      const path = window.location.pathname;
      const isAdmin = path.startsWith("/.tanny.admin") || path.startsWith("/tanny-admin");
      setIsAdminRoute(isAdmin);
      return isAdmin;
    };

    const currentIsAdmin = checkRoute();

    // STRICT ISOLATION: If not an admin route, remove any admin manifest and do NOT hook install events
    if (!currentIsAdmin) {
      const manifest = document.getElementById("admin-pwa-manifest");
      if (manifest) {
        manifest.remove();
      }
      return;
    }

    // ADMIN ROUTE: Inject Admin PWA Manifest dynamically
    let manifestLink = document.getElementById("admin-pwa-manifest") as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.id = "admin-pwa-manifest";
      manifestLink.rel = "manifest";
      manifestLink.href = "/admin-manifest.json";
      document.head.appendChild(manifestLink);
    }

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Check standalone mode
    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://");
      if (isStandalone) {
        setIsInstalled(true);
        localStorage.setItem("pwa_admin_installed", "true");
      }
    };
    checkStandalone();

    // Register Service Worker for Admin Portal
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          registration.addEventListener("updatefound", () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.addEventListener("statechange", () => {
                if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("[PWA Admin] New admin version ready");
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn("[PWA Admin] Service worker registration warning:", err);
        });
    }

    // Capture beforeinstallprompt for Admin only
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Capture appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setInstallStatus("accepted");
      localStorage.setItem("pwa_admin_installed", "true");
      console.log("[PWA Admin] Admin App successfully installed on device!");
    };

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
        localStorage.setItem("pwa_admin_installed", "true");
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
    if (!isAdminRoute || !deferredPrompt) {
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
        localStorage.setItem("pwa_admin_installed", "true");
        return { outcome: "accepted" };
      } else {
        setInstallStatus("dismissed");
        return { outcome: "dismissed" };
      }
    } catch (err) {
      console.error("[PWA Admin] prompt error:", err);
      setInstallStatus("dismissed");
      return { outcome: "dismissed" };
    }
  }, [isAdminRoute, deferredPrompt]);

  return {
    isAdminRoute,
    isInstallable: isAdminRoute && !!deferredPrompt && !isInstalled,
    isInstalled,
    isIOS: isAdminRoute && isIOS,
    isOnline,
    installStatus,
    promptInstall,
  };
}
