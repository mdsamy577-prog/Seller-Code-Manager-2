import React from "react";
import { usePWA } from "@/hooks/use-pwa";
import { WifiOff } from "lucide-react";

export const OfflineIndicator: React.FC = () => {
  const { isOnline } = usePWA();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-md animate-in slide-in-from-top-full duration-200">
      <WifiOff className="w-4 h-4 animate-pulse text-amber-950" />
      <span>ইন্টারনেট সংযোগ বিচ্ছিন্ন — অফলাইন ক্যাশ মোডে চলছে</span>
    </div>
  );
};
