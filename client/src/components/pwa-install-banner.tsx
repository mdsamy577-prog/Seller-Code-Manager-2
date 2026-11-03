import React, { useState } from "react";
import { usePWA } from "@/hooks/use-pwa";
import { Download, Smartphone, X, CheckCircle, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PWAInstallButtonProps {
  variant?: "banner" | "button" | "header" | "admin";
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = "button", className = "" }) => {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWA();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running in standalone mode or already installed, hide completely
  if (isInstalled) {
    return null;
  }

  // Handle native install trigger
  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!isInstallable) {
      // If beforeinstallprompt hasn't fired yet or browser doesn't support it directly
      return;
    }

    setIsInstalling(true);
    const result = await promptInstall();
    setIsInstalling(false);

    if (result.outcome === "accepted") {
      setBannerDismissed(true);
    }
  };

  // If banner variant was dismissed by the user in this session, hide
  if (variant === "banner" && (bannerDismissed || (!isInstallable && !isIOS))) {
    return null;
  }

  // If header/button and not installable on Android (and not iOS), don't render clutter
  if ((variant === "header" || variant === "button" || variant === "admin") && !isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      {variant === "admin" && (
        <Button
          onClick={handleInstallClick}
          variant="outline"
          size="sm"
          disabled={isInstalling}
          className={`flex items-center gap-1.5 text-xs font-semibold rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 shadow-sm transition-all ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>{isInstalling ? "প্রম্পট ওপেন হচ্ছে..." : "অ্যাডমিন অ্যাপ ইনস্টল"}</span>
        </Button>
      )}

      {variant === "header" && (
        <Button
          onClick={handleInstallClick}
          variant="outline"
          size="sm"
          disabled={isInstalling}
          className={`flex items-center gap-1.5 text-xs font-medium rounded-xl border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isInstalling ? "প্রম্পট ওপেন হচ্ছে..." : "অ্যাপ ইনস্টল"}</span>
        </Button>
      )}

      {variant === "button" && (
        <Button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all ${className}`}
        >
          <Download className="w-4 h-4" />
          <span>{isInstalling ? "প্রম্পট ওপেন হচ্ছে..." : "মোবাইল অ্যাপ ইনস্টল করুন"}</span>
        </Button>
      )}

      {variant === "banner" && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-md p-4 shadow-xl dark:shadow-black/50 text-card-foreground">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <h4 className="text-sm font-bold text-foreground">
                  Seller Code Registry অ্যাপ
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  হোম স্ক্রিনে সরাসরি ইনস্টল করে দ্রুত সেলার যাচাই ও সার্বিক তথ্য দেখুন।
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    onClick={handleInstallClick}
                    size="sm"
                    disabled={isInstalling}
                    className="h-8 px-3 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    {isInstalling ? "প্রম্পট লোড হচ্ছে..." : "ইনস্টল করুন"}
                  </Button>
                  <Button
                    onClick={() => setBannerDismissed(true)}
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                  >
                    এখন নয়
                  </Button>
                </div>
              </div>
              <button
                onClick={() => setBannerDismissed(true)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
                aria-label="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Installation Instruction Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-6 shadow-2xl text-card-foreground animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">iPhone / iPad-এ ইনস্টল করুন</h3>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 my-4 text-xs text-muted-foreground">
              <div className="flex items-start gap-3 bg-muted/40 p-3 rounded-xl border border-border/50">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs">
                  ১
                </span>
                <p className="text-foreground">
                  Safari ব্রাউজারের নিচের টুলবারে <Share className="w-3.5 h-3.5 inline mx-1 text-primary" /> <strong>Share</strong> আইকনে ট্যাপ করুন।
                </p>
              </div>

              <div className="flex items-start gap-3 bg-muted/40 p-3 rounded-xl border border-border/50">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs">
                  ২
                </span>
                <p className="text-foreground">
                  নিচে স্ক্রল করে <strong>Add to Home Screen</strong> (হোম স্ক্রিনে যোগ করুন) অপশনটি চাপুন।
                </p>
              </div>

              <div className="flex items-start gap-3 bg-muted/40 p-3 rounded-xl border border-border/50">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs">
                  ৩
                </span>
                <p className="text-foreground">
                  ডানদিকের ওপরে <strong>Add</strong> চাপলেই অ্যাপটি ইনস্টল হয়ে যাবে।
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowIOSModal(false)}
              className="w-full rounded-xl bg-primary text-primary-foreground font-semibold text-xs py-2"
            >
              ঠিক আছে
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
