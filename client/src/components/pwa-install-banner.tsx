import React, { useState } from "react";
import { usePWA } from "@/hooks/use-pwa";
import { Smartphone, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PWAInstallButtonProps {
  variant?: "admin" | "button" | "header" | "banner";
  className?: string;
}

/**
 * PWAInstallButton - STRICT ADMIN-ONLY PWA INSTALLATION COMPONENT
 * Will NEVER render on public or customer routes under any circumstance.
 */
export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = "admin", className = "" }) => {
  const { isAdminRoute, isInstallable, isInstalled, isIOS, promptInstall } = usePWA();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // STRICT RULE: If not on an admin route, or if already running as installed app, never render
  if (!isAdminRoute || isInstalled) {
    return null;
  }

  // Handle native install trigger for admin
  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!isInstallable) {
      return;
    }

    setIsInstalling(true);
    await promptInstall();
    setIsInstalling(false);
  };

  // If not installable and not iOS on admin, return null
  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      <Button
        onClick={handleInstallClick}
        variant="outline"
        size="sm"
        disabled={isInstalling}
        title="সেলার কোড অ্যাডমিন পোর্টাল ইনস্টল করুন"
        className={`flex items-center gap-1.5 text-xs font-semibold rounded-xl border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 shadow-xs transition-all ${className}`}
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>{isInstalling ? "প্রম্পট লোড হচ্ছে..." : "অ্যাডমিন অ্যাপ ইনস্টল"}</span>
      </Button>

      {/* iOS Installation Instruction Modal for Admin */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-6 shadow-2xl text-card-foreground animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base text-foreground">অ্যাডমিন অ্যাপ ইনস্টল (iOS)</h3>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 my-4 text-xs text-muted-foreground">
              <p className="text-foreground font-medium">
                Safari ব্রাউজার দিয়ে অ্যাডমিন পোর্টালকে আলাদা অ্যাপ হিসেবে হোম স্ক্রিনে যোগ করুন:
              </p>
              <div className="flex items-start gap-2.5 bg-muted/40 p-2.5 rounded-xl border border-border/50">
                <span className="shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 font-bold flex items-center justify-center text-xs">
                  ১
                </span>
                <p className="text-foreground">
                  নিচের টুলবারে <Share className="w-3.5 h-3.5 inline mx-1 text-primary" /> <strong>Share</strong> চাপুন।
                </p>
              </div>
              <div className="flex items-start gap-2.5 bg-muted/40 p-2.5 rounded-xl border border-border/50">
                <span className="shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 font-bold flex items-center justify-center text-xs">
                  ২
                </span>
                <p className="text-foreground">
                  মেনু থেকে <strong>Add to Home Screen</strong> চাপুন।
                </p>
              </div>
              <div className="flex items-start gap-2.5 bg-muted/40 p-2.5 rounded-xl border border-border/50">
                <span className="shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 font-bold flex items-center justify-center text-xs">
                  ৩
                </span>
                <p className="text-foreground">
                  উপরে ডানদিকের <strong>Add</strong> চাপুন।
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowIOSModal(false)}
              className="w-full rounded-xl bg-primary text-primary-foreground font-semibold text-xs py-2"
            >
              বন্ধ করুন
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
